import os
import io
import logging
import requests
import hashlib
from celery import Celery
from PIL import Image
import imagehash
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from backend.config import settings
from backend.database import SessionLocal
from backend.models import Photo, Face, FaceCluster, SyncSource
from backend.ai_models import (
    get_image_embedding, 
    classify_image, 
    detect_and_embed_faces, 
    cluster_face_embeddings
)

logger = logging.getLogger("photo-manager.tasks")

# Initialize Celery app
celery_app = Celery("photo_tasks", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

# Configure Celery settings
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

@celery_app.task(name="backend.tasks.process_photo_task")
def process_photo_task(photo_id: int, download_url: str = None):
    """
    Background Celery task that processes a single photo:
    1. Computes MD5 and pHash for duplicate detection.
    2. Runs CLIP zero-shot classification for auto-categorization.
    3. Runs CLIP image embedding extraction for natural language search.
    4. Runs MTCNN and FaceNet for face detection and embedding extraction.
    """
    logger.info(f"Processing photo {photo_id}...")
    db: Session = SessionLocal()
    
    try:
        photo = db.query(Photo).filter(Photo.id == photo_id).first()
        if not photo:
            logger.error(f"Photo {photo_id} not found in database.")
            return
            
        img = None
        img_bytes = None
        
        # Load image based on storage provider
        if photo.storage_provider == "local":
            if os.path.exists(photo.provider_photo_id):
                with open(photo.provider_photo_id, "rb") as f:
                    img_bytes = f.read()
                img = Image.open(photo.provider_photo_id)
            else:
                logger.error(f"Local photo path {photo.provider_photo_id} does not exist.")
                return
        elif photo.storage_provider == "google_photos":
            if download_url:
                response = requests.get(download_url, timeout=30)
                if response.status_code == 200:
                    img_bytes = response.content
                    img = Image.open(io.BytesIO(img_bytes))
                else:
                    logger.error(f"Failed to download Google Photo from {download_url}, status code {response.status_code}")
                    return
            else:
                logger.error(f"Google Photo {photo_id} missing download_url.")
                return
        
        if img is None:
            logger.error(f"Failed to open image for photo {photo_id}")
            return
            
        # 1. Exact Duplicate (MD5 Checksum)
        if not photo.md5 and img_bytes:
            photo.md5 = hashlib.md5(img_bytes).hexdigest()
            
        # Update width/height if missing
        if not photo.width or not photo.height:
            photo.width, photo.height = img.size
            
        # 2. Near-Duplicate Hashing (pHash)
        # Calculate perceptual hash
        hash_obj = imagehash.phash(img)
        hash_str = str(hash_obj)  # 16-character hex representation of 64 bits
        
        # Format as binary string for PostgreSQL BIT(64) column
        bin_str = bin(int(hash_str, 16))[2:].zfill(64)
        photo.phash = bin_str
        
        # Multi-Index Hashing segments (split 16-char hex into four 16-bit blocks)
        photo.phash_part1 = int(hash_str[0:4], 16)
        photo.phash_part2 = int(hash_str[4:8], 16)
        photo.phash_part3 = int(hash_str[8:12], 16)
        photo.phash_part4 = int(hash_str[12:16], 16)
        
        # 3. AI Categorization
        category, confidence = classify_image(img)
        photo.category = category
        photo.category_confidence = confidence
        
        # 4. Dense Visual Search Embedding (CLIP)
        clip_emb = get_image_embedding(img)
        photo.clip_embedding = clip_emb
        
        # 5. Face Detection & Recognition
        # Clear existing faces to avoid duplicates on re-processing
        db.query(Face).filter(Face.photo_id == photo.id).delete()
        
        faces_detected = detect_and_embed_faces(img)
        for face_data in faces_detected:
            new_face = Face(
                photo_id=photo.id,
                box_x1=face_data["box"][0],
                box_y1=face_data["box"][1],
                box_x2=face_data["box"][2],
                box_y2=face_data["box"][3],
                embedding=face_data["embedding"]
            )
            db.add(new_face)
            
        db.commit()
        logger.info(f"Photo {photo_id} processed successfully. Category: {category}. Faces detected: {len(faces_detected)}.")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing photo {photo_id}: {e}", exc_info=True)
    finally:
        db.close()

@celery_app.task(name="backend.tasks.cluster_faces_task")
def cluster_faces_task(eps: float = 0.55, min_samples: int = 2):
    """
    Background Celery task that clusters all extracted face embeddings
    using DBSCAN and manages FaceCluster (Person) records.
    """
    logger.info("Starting face clustering task...")
    db: Session = SessionLocal()
    
    try:
        # 1. Fetch all faces with embeddings
        # We need to fetch face ID and embedding
        # pgvector returns embeddings as list of floats, which SQLAlchemy parses automatically
        faces = db.query(Face.id, Face.embedding).all()
        if not faces or len(faces) < min_samples:
            logger.info("Not enough faces found to perform clustering.")
            return
            
        faces_list = [(f.id, f.embedding) for f in faces]
        
        # Run clustering
        logger.info(f"Running DBSCAN clustering on {len(faces_list)} faces...")
        cluster_map = cluster_face_embeddings(faces_list, eps=eps, min_samples=min_samples)
        
        # 2. Update face records with cluster IDs
        # Group by label to create Person records
        unique_labels = set(cluster_map.values())
        
        # Dictionary to cache database cluster IDs: label -> DB cluster ID
        db_clusters = {}
        
        # Create database FaceCluster entries for valid clusters (label >= 0)
        for label in unique_labels:
            if label < 0:
                continue  # Skip noise cluster
                
            cluster_name = f"Person {label + 1}"
            
            # Check if cluster already exists (we can match by name or map labels, but on re-run, labels might shift,
            # so for simplicity we overwrite clusters during complete clustering runs, or keep a stable mapping.
            # In a production app, we would merge clusters. Here we will create clusters for each label).
            existing_cluster = db.query(FaceCluster).filter(FaceCluster.name == cluster_name).first()
            if not existing_cluster:
                new_cluster = FaceCluster(name=cluster_name)
                db.add(new_cluster)
                db.flush()  # Populate id
                db_clusters[label] = new_cluster.id
            else:
                db_clusters[label] = existing_cluster.id
                
        # 3. Save clusters to faces
        for face_id, label in cluster_map.items():
            face = db.query(Face).filter(Face.id == face_id).first()
            if face:
                if label >= 0:
                    face.face_cluster_id = db_clusters[label]
                else:
                    face.face_cluster_id = None  # Reset to noise if unclustered
                    
        db.commit()
        
        # 4. Clean up any empty face clusters
        # Delete FaceClusters that have 0 associated faces
        empty_clusters = db.query(FaceCluster).filter(
            ~FaceCluster.faces.any()
        ).all()
        
        for c in empty_clusters:
            db.delete(c)
            
        # 5. Assign cover faces for all clusters
        active_clusters = db.query(FaceCluster).all()
        for c in active_clusters:
            # Pick first face as cover image if not set or invalid
            first_face = db.query(Face).filter(Face.face_cluster_id == c.id).first()
            if first_face:
                c.cover_face_id = first_face.id
                
        db.commit()
        logger.info(f"Face clustering completed. Managed {len(active_clusters)} people clusters.")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error clustering faces: {e}", exc_info=True)
    finally:
        db.close()
