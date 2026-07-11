import os
import io
import random
import logging
import hashlib
import imagehash
import numpy as np
from PIL import Image, ImageDraw
from datetime import datetime, timedelta
from typing import List, Dict, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, func, desc

from backend.database import get_db, init_db
from backend.config import settings
from backend.models import Photo, Face, FaceCluster, SyncSource
from backend.schemas import (
    SyncSourceCreate, SyncSourceResponse, PhotoResponse, 
    FaceClusterResponse, FaceResponse, DashboardStats, 
    SearchQuery, DuplicateGroup
)
from backend.ai_models import get_text_embedding
from backend.indexer import scan_local_directory, sync_google_photos_library

# Helper to generate mock image placeholder when files do not exist on disk
def generate_placeholder_image(text_label: str, width: int = 400, height: int = 400):
    h = int(hashlib.md5(text_label.encode()).hexdigest(), 16)
    r = ((h & 0xFF0000) >> 16) % 120 + 40
    g = ((h & 0x00FF00) >> 8) % 120 + 40
    b = (h & 0x0000FF) % 120 + 40
    
    img = Image.new("RGB", (width, height), color=(r, g, b))
    draw = ImageDraw.Draw(img)
    
    # Draw simple frame border
    draw.rectangle([width//10, height//10, width*9//10, height*9//10], outline="#ffffff", width=2)
    
    # Draw label text
    lines = text_label.split('\n')
    for idx, line in enumerate(lines):
        draw.text((width//8, height//3 + idx*20), line, fill="#ffffff")
        
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("photo-manager.api")

app = FastAPI(
    title="AuraPhoto API",
    description="AI-Powered Photo Management Platform API",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    logger.info("Initializing Database...")
    init_db()

# ==========================================
# Health Check & Basic Endpoints
# ==========================================
@app.get("/api/v1/health", tags=["System"])
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow()}

# ==========================================
# Sync Sources Management
# ==========================================
@app.get("/api/v1/sync-sources", response_model=List[SyncSourceResponse], tags=["Sync Sources"])
def list_sync_sources(db: Session = Depends(get_db)):
    return db.query(SyncSource).all()

@app.post("/api/v1/sync-sources", response_model=SyncSourceResponse, tags=["Sync Sources"])
def create_sync_source(source: SyncSourceCreate, db: Session = Depends(get_db)):
    if source.source_type == "local" and not source.path:
        raise HTTPException(status_code=400, detail="Path is required for local sync sources.")
    
    # Check if duplicate local source
    if source.source_type == "local":
        existing = db.query(SyncSource).filter(
            SyncSource.source_type == "local", 
            SyncSource.path == source.path
        ).first()
        if existing:
            return existing
            
    new_source = SyncSource(
        source_type=source.source_type,
        path=source.path,
        status="idle"
    )
    db.add(new_source)
    db.commit()
    db.refresh(new_source)
    return new_source

@app.delete("/api/v1/sync-sources/{source_id}", tags=["Sync Sources"])
def delete_sync_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(SyncSource).filter(SyncSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Sync source not found.")
    db.delete(source)
    db.commit()
    return {"message": "Sync source deleted successfully."}

@app.post("/api/v1/sync-sources/{source_id}/sync", tags=["Sync Sources"])
def trigger_sync(
    source_id: int, 
    background_tasks: BackgroundTasks, 
    simulate: bool = Query(False, description="Simulate Google Photos or local folder sync"),
    db: Session = Depends(get_db)
):
    source = db.query(SyncSource).filter(SyncSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Sync source not found.")
        
    if source.status == "syncing":
        return {"message": "Sync is already in progress.", "status": source.status}
        
    if source.source_type == "local":
        background_tasks.add_task(scan_local_directory, db, source.id)
    elif source.source_type == "google_photos":
        background_tasks.add_task(sync_google_photos_library, db, source.id, simulate=simulate)
        
    return {"message": "Sync started in background.", "status": "syncing"}

# ==========================================
# Photos Management
# ==========================================
@app.get("/api/v1/photos", response_model=Dict, tags=["Photos"])
def list_photos(
    page: int = 1,
    limit: int = 30,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    offset = (page - 1) * limit
    query = db.query(Photo)
    
    if category:
        query = query.filter(Photo.category == category)
        
    total = query.count()
    # Order by capture date (newest first)
    photos = query.order_by(desc(Photo.captured_at), desc(Photo.id)).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "photos": [PhotoResponse.from_orm(p) for p in photos]
    }

@app.get("/api/v1/photos/{photo_id}", response_model=PhotoResponse, tags=["Photos"])
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found.")
    return photo

@app.delete("/api/v1/photos/{photo_id}", tags=["Photos"])
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found.")
        
    # Delete local file if it's local
    if photo.storage_provider == "local" and os.path.exists(photo.provider_photo_id):
        try:
            os.remove(photo.provider_photo_id)
        except Exception as e:
            logger.error(f"Failed to delete local file {photo.provider_photo_id}: {e}")
            
    db.delete(photo)
    db.commit()
    return {"message": "Photo deleted successfully."}

@app.get("/api/v1/photos/{photo_id}/raw", tags=["Photos"])
def get_raw_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found.")
        
    if photo.storage_provider == "local":
        if os.path.exists(photo.provider_photo_id):
            return FileResponse(photo.provider_photo_id, media_type=photo.mime_type)
        else:
            # Return generated placeholder for mock images
            buffer = generate_placeholder_image(f"{photo.filename}\n({photo.category or 'uncategorized'})", 400, 400)
            return StreamingResponse(buffer, media_type="image/jpeg")
    elif photo.storage_provider == "google_photos":
        # Check if it's a simulated photo (prefixed with 'sim_')
        if photo.provider_photo_id.startswith("sim_"):
            # Find the mock URL
            from backend.indexer import SIMULATED_PHOTOS
            match = next((item for item in SIMULATED_PHOTOS if item["id"] == photo.provider_photo_id), None)
            if match:
                return RedirectResponse(url=match["url"])
        
        # Redirect to the Google Photos base URL (temporary) or return 404
        return RedirectResponse(url=f"https://photoslibrary.googleapis.com/v1/mediaItems/{photo.provider_photo_id}")

# ==========================================
# Duplicates Detection
# ==========================================
@app.get("/api/v1/duplicates", response_model=List[DuplicateGroup], tags=["Duplicates"])
def find_duplicates(db: Session = Depends(get_db)):
    """
    Find both exact and near-duplicates.
    1. Exact: matching MD5 checksums.
    2. Near: Hamming distance <= 4 on pHash, accelerated using Multi-Index Hashing segments.
    """
    # ---- 1. EXACT DUPLICATES (MD5) ----
    exact_groups = []
    # Find MD5s that appear more than once
    md5_dups = db.query(Photo.md5).filter(Photo.md5.isnot(None))\
        .group_by(Photo.md5).having(func.count(Photo.id) > 1).all()
        
    processed_ids = set()
    
    for (md5_val,) in md5_dups:
        photos = db.query(Photo).filter(Photo.md5 == md5_val).order_by(Photo.id).all()
        if photos:
            original = photos[0]
            duplicates = photos[1:]
            
            exact_groups.append(DuplicateGroup(
                original=PhotoResponse.from_orm(original),
                duplicates=[PhotoResponse.from_orm(d) for d in duplicates],
                duplicate_type="exact"
            ))
            for p in photos:
                processed_ids.add(p.id)
                
    # ---- 2. NEAR DUPLICATES (pHash MIH) ----
    near_groups = []
    # Query matching candidate pairs based on Multi-Index Hashing (MIH) segments
    # Filter out exact duplicates (which share same MD5) and pairs already grouped
    mih_query = text("""
        SELECT p1.id as id1, p2.id as id2, bit_count(p1.phash # p2.phash) as dist
        FROM photos p1
        JOIN photos p2 ON p1.id < p2.id
        WHERE (
            p1.phash_part1 = p2.phash_part1 OR 
            p1.phash_part2 = p2.phash_part2 OR 
            p1.phash_part3 = p2.phash_part3 OR 
            p1.phash_part4 = p2.phash_part4
        )
        AND bit_count(p1.phash # p2.phash) <= 4
        AND (p1.md5 IS NULL OR p2.md5 IS NULL OR p1.md5 != p2.md5)
    """)
    
    pairs = db.execute(mih_query).fetchall()
    
    # Simple disjoint-set clustering to group pairs into duplicate sets
    parent = {}
    
    def find_parent(i):
        if parent[i] == i:
            return i
        parent[i] = find_parent(parent[i])
        return parent[i]
        
    def union_set(i, j):
        root_i = find_parent(i)
        root_j = find_parent(j)
        if root_i != root_j:
            parent[root_j] = root_i
            
    for id1, id2, dist in pairs:
        # Avoid including exact duplicates in near-duplicate results
        if id1 in processed_ids or id2 in processed_ids:
            continue
        if id1 not in parent: parent[id1] = id1
        if id2 not in parent: parent[id2] = id2
        union_set(id1, id2)
        
    # Group by roots
    clusters = {}
    for node in parent:
        root = find_parent(node)
        if root not in clusters:
            clusters[root] = []
        clusters[root].append(node)
        
    # Build DuplicateGroup responses
    for root, member_ids in clusters.items():
        if len(member_ids) > 1:
            member_photos = db.query(Photo).filter(Photo.id.in_(member_ids)).order_by(Photo.id).all()
            if member_photos:
                original = member_photos[0]
                duplicates = member_photos[1:]
                near_groups.append(DuplicateGroup(
                    original=PhotoResponse.from_orm(original),
                    duplicates=[PhotoResponse.from_orm(d) for d in duplicates],
                    duplicate_type="near"
                ))
                
    return exact_groups + near_groups

# ==========================================
# Natural Language Vector Search
# ==========================================
@app.post("/api/v1/search", response_model=List[PhotoResponse], tags=["Search"])
def search_photos(query: SearchQuery, db: Session = Depends(get_db)):
    """
    Search photos using natural language query via CLIP vector search.
    Performs Cosine Similarity vector matching using pgvector index.
    """
    if not query.query.strip():
        return []
        
    try:
        # Get 512-dimensional CLIP embedding of query text
        query_vector = get_text_embedding(query.query)
        
        # Query closest matches
        # pgvector cosine_distance <=> matches (1 - cosine_similarity)
        # So sorting ASC gives highest similarity first.
        results = db.query(Photo).filter(
            Photo.clip_embedding.isnot(None)
        ).order_by(
            Photo.clip_embedding.cosine_distance(query_vector)
        ).limit(query.limit).all()
        
        return results
    except Exception as e:
        logger.error(f"Search failed for query '{query.query}': {e}", exc_info=True)
        # Fallback to simple filename substring search if AI model fails
        return db.query(Photo).filter(Photo.filename.ilike(f"%{query.query}%")).limit(query.limit).all()

# ==========================================
# Face Clusters (People) Management
# ==========================================
@app.get("/api/v1/people", response_model=List[FaceClusterResponse], tags=["People"])
def list_people_clusters(db: Session = Depends(get_db)):
    """List all clustered human face profiles with face count."""
    clusters = db.query(FaceCluster).all()
    results = []
    for c in clusters:
        count = db.query(Face).filter(Face.face_cluster_id == c.id).count()
        results.append(FaceClusterResponse(
            id=c.id,
            name=c.name,
            cover_face_id=c.cover_face_id,
            faces_count=count
        ))
    # Sort clusters by size (largest first)
    results.sort(key=lambda x: x.faces_count, reverse=True)
    return results

@app.get("/api/v1/people/{cluster_id}", response_model=Dict, tags=["People"])
def get_person_details(cluster_id: int, db: Session = Depends(get_db)):
    """Get person profile details, including all photos containing this person."""
    cluster = db.query(FaceCluster).filter(FaceCluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Person not found.")
        
    # Get all faces in this cluster
    faces = db.query(Face).filter(Face.face_cluster_id == cluster_id).all()
    photo_ids = [f.photo_id for f in faces]
    
    # Get all photos
    photos = db.query(Photo).filter(Photo.id.in_(photo_ids)).order_by(desc(Photo.captured_at)).all()
    
    return {
        "id": cluster.id,
        "name": cluster.name,
        "cover_face_id": cluster.cover_face_id,
        "faces_count": len(faces),
        "photos": [PhotoResponse.from_orm(p) for p in photos]
    }

@app.put("/api/v1/people/{cluster_id}", tags=["People"])
def update_person_name(cluster_id: int, payload: Dict, db: Session = Depends(get_db)):
    """Update a person's name (e.g. from 'Person 1' to 'Alice')."""
    cluster = db.query(FaceCluster).filter(FaceCluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Person not found.")
        
    name = payload.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty.")
        
    cluster.name = name
    db.commit()
    return {"message": "Person name updated successfully.", "id": cluster.id, "name": cluster.name}

@app.get("/api/v1/faces/{face_id}/raw", tags=["People"])
def get_raw_face_thumbnail(face_id: int, db: Session = Depends(get_db)):
    """Extract and return the cropped thumbnail of a detected face."""
    face = db.query(Face).filter(Face.id == face_id).first()
    if not face:
        raise HTTPException(status_code=404, detail="Face not found.")
        
    photo = db.query(Photo).filter(Photo.id == face.photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Associated photo not found.")
        
    try:
        # Load source photo
        if photo.storage_provider == "local":
            if os.path.exists(photo.provider_photo_id):
                img = Image.open(photo.provider_photo_id)
            else:
                # Return generated placeholder for mock face crop
                buffer = generate_placeholder_image(f"Person", 120, 120)
                return StreamingResponse(buffer, media_type="image/jpeg")
        elif photo.storage_provider == "google_photos":
            # For simulation or live fetch
            if photo.provider_photo_id.startswith("sim_"):
                from backend.indexer import SIMULATED_PHOTOS
                match = next((item for item in SIMULATED_PHOTOS if item["id"] == photo.provider_photo_id), None)
                if match:
                    # Download the image to crop
                    resp = requests.get(match["url"], timeout=15)
                    if resp.status_code == 200:
                        img = Image.open(io.BytesIO(resp.content))
                    else:
                        raise HTTPException(status_code=404, detail="Failed to fetch simulated photo.")
                else:
                    raise HTTPException(status_code=404, detail="Simulated photo metadata missing.")
            else:
                # Live photos fetch would require access token, streaming for simplicity redirect
                return RedirectResponse(url=f"https://photoslibrary.googleapis.com/v1/mediaItems/{photo.provider_photo_id}")

        width, height = img.size
        # Bounding box is normalized coords
        x1 = int(face.box_x1 * width)
        y1 = int(face.box_y1 * height)
        x2 = int(face.box_x2 * width)
        y2 = int(face.box_y2 * height)
        
        # Crop and save to buffer
        face_img = img.crop((x1, y1, x2, y2)).resize((120, 120))
        buffer = io.BytesIO()
        face_img.save(buffer, format="JPEG")
        buffer.seek(0)
        
        return StreamingResponse(buffer, media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Failed to generate face crop: {e}")
        # Return generic avatar if failed
        raise HTTPException(status_code=500, detail="Failed to crop face thumbnail.")

@app.post("/api/v1/people/cluster", tags=["People"])
def trigger_face_clustering(background_tasks: BackgroundTasks):
    """Manually run face clustering (DBSCAN worker task)."""
    from backend.tasks import cluster_faces_task
    cluster_faces_task.delay()
    return {"message": "Face clustering task queued in background."}

# ==========================================
# Dashboard Statistics
# ==========================================
@app.get("/api/v1/dashboard/stats", response_model=DashboardStats, tags=["Dashboard"])
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_photos = db.query(Photo).count()
    
    # Group by category counts
    cat_counts = db.query(Photo.category, func.count(Photo.id)).group_by(Photo.category).all()
    by_category = {c or "uncategorized": count for c, count in cat_counts}
    
    # Ensure all categories exist in dict
    for cat in ["document", "prescription", "receipt", "people", "travel", "pets", "other"]:
        if cat not in by_category:
            by_category[cat] = 0
            
    # Exact duplicate files count
    exact_count = db.query(Photo.md5).filter(Photo.md5.isnot(None))\
        .group_by(Photo.md5).having(func.count(Photo.id) > 1).all()
    exact_duplicates_count = sum([db.query(Photo).filter(Photo.md5 == m[0]).count() - 1 for m in exact_count])
    
    # Near duplicates count (Hamming Distance <= 4, accelerated via MIH)
    mih_query = text("""
        SELECT COUNT(DISTINCT p1.id)
        FROM photos p1
        JOIN photos p2 ON p1.id < p2.id
        WHERE (
            p1.phash_part1 = p2.phash_part1 OR 
            p1.phash_part2 = p2.phash_part2 OR 
            p1.phash_part3 = p2.phash_part3 OR 
            p1.phash_part4 = p2.phash_part4
        )
        AND bit_count(p1.phash # p2.phash) <= 4
        AND (p1.md5 IS NULL OR p2.md5 IS NULL OR p1.md5 != p2.md5)
    """)
    near_duplicates_count = db.execute(mih_query).scalar() or 0
    
    total_faces = db.query(Face).count()
    total_clusters = db.query(FaceCluster).count()
    
    return DashboardStats(
        total_photos=total_photos,
        by_category=by_category,
        exact_duplicates_count=exact_duplicates_count,
        near_duplicates_count=near_duplicates_count,
        total_faces=total_faces,
        total_clusters=total_clusters
    )

# ==========================================
# Seeding / Scaling Benchmark
# ==========================================
@app.post("/api/v1/benchmark/seed", tags=["System"])
def seed_large_benchmark_dataset(
    count: int = Query(100000, description="Number of synthetic items to seed"),
    db: Session = Depends(get_db)
):
    """
    Seed 100,000 synthetic image items to demonstrate UI page loading speeds,
    pgvector HNSW index sub-10ms search lookups, and Multi-Index Hashing speed.
    """
    logger.info(f"Seeding database with {count} synthetic items...")
    
    # Clear existing photos to allow clean seeding (optional, but good for test consistency)
    db.query(Face).delete()
    db.query(FaceCluster).delete()
    db.query(Photo).delete()
    db.query(SyncSource).delete()
    db.commit()
    
    # 1. Create a dummy local sync source
    source = SyncSource(
        source_type="local",
        path="/photos/benchmark_synthetic",
        status="completed",
        last_sync_at=datetime.utcnow()
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    
    # Pre-generate 100 base face embeddings for Face Clustering representation
    base_face_vectors = [np_random_unit_vector(512) for _ in range(100)]
    
    # Bulk insert configuration
    batch_size = 5000
    photos_batch = []
    faces_batch = []
    
    categories = ["document", "prescription", "receipt", "people", "travel", "pets", "other"]
    weights = [0.1, 0.05, 0.15, 0.25, 0.25, 0.15, 0.05]  # realistic distribution
    
    base_time = datetime.utcnow()
    
    # Track exact duplicate MD5s and near duplicate hashes to seed them deliberately
    # We will create 200 groups of exact duplicates (each group size 2-3)
    # We will create 300 groups of near duplicates (each group size 2)
    exact_dup_md5s = [hashlib.md5(f"exact_dup_{i}".encode()).hexdigest() for i in range(200)]
    near_dup_hashes = []
    for i in range(300):
        # Base hash
        base_h = imagehash.hex_to_hash(f"{random.randint(0, 2**64):016x}")
        near_dup_hashes.append(base_h)
        
    for i in range(1, count + 1):
        # 1. MD5 generation
        md5_val = None
        if i <= 400: # First 400 items mapped into 200 exact duplicates groups
            md5_val = exact_dup_md5s[(i - 1) // 2]
        else:
            md5_val = hashlib.md5(f"unique_photo_{i}".encode()).hexdigest()
            
        # 2. pHash generation
        phash_str = None
        if i > 400 and i <= 1000: # Items 401-1000 mapped into 300 near-duplicates groups
            base_hash = near_dup_hashes[(i - 401) // 2]
            if i % 2 == 0:
                # Flip 2 bits to create a near-duplicate
                phash_str = str(base_hash)
            else:
                # Original
                phash_str = str(base_hash)
                # Flip 2 bits manually in the hex string representation
                ph_arr = list(phash_str)
                ph_arr[0] = 'f' if ph_arr[0] != 'f' else '0'
                ph_arr[15] = 'a' if ph_arr[15] != 'a' else '1'
                phash_str = "".join(ph_arr)
        else:
            # Entirely random hash
            phash_str = f"{random.randint(0, 2**64-1):016x}"
            
        bin_str = bin(int(phash_str, 16))[2:].zfill(64)
        
        # Categories
        cat = random.choices(categories, weights=weights)[0]
        confidence = float(random.uniform(0.65, 0.99))
        
        # Generate CLIP embedding (synthetic normalized unit vector)
        clip_emb = np_random_unit_vector(512)
        
        photo_id = i
        photo_record = {
            "id": photo_id,
            "storage_provider": "local",
            "provider_photo_id": f"/photos/benchmark_synthetic/synthetic_{i}.jpg",
            "filename": f"synthetic_{i}.jpg",
            "mime_type": "image/jpeg",
            "file_size": random.randint(100000, 8000000),
            "width": random.choice([1920, 2048, 3840, 4000]),
            "height": random.choice([1080, 1536, 2160, 3000]),
            "captured_at": base_time - timedelta(days=random.randint(0, 730), seconds=random.randint(0, 86400)),
            "indexed_at": datetime.utcnow(),
            "md5": md5_val,
            "phash": bin_str,
            "phash_part1": int(phash_str[0:4], 16),
            "phash_part2": int(phash_str[4:8], 16),
            "phash_part3": int(phash_str[8:12], 16),
            "phash_part4": int(phash_str[12:16], 16),
            "clip_embedding": clip_emb,
            "category": cat,
            "category_confidence": confidence
        }
        photos_batch.append(photo_record)
        
        # Seed faces (if category is 'people' or by 30% chance)
        if cat == "people" or random.random() < 0.25:
            # Create 1 to 3 faces for this photo
            num_faces = random.randint(1, 3)
            for _ in range(num_faces):
                # Pick a random base face, add tiny noise, L2 normalize
                base_idx = random.randint(0, 99)
                base_vec = base_face_vectors[base_idx]
                noise = np.random.normal(0, 0.05, 512)
                face_vec = base_vec + noise
                face_vec = face_vec / np.linalg.norm(face_vec)
                
                face_record = {
                    "photo_id": photo_id,
                    "box_x1": float(random.uniform(0.1, 0.4)),
                    "box_y1": float(random.uniform(0.1, 0.4)),
                    "box_x2": float(random.uniform(0.5, 0.8)),
                    "box_y2": float(random.uniform(0.5, 0.8)),
                    "embedding": face_vec.tolist(),
                    "face_cluster_id": None
                }
                faces_batch.append(face_record)
                
        # Bulk insert when batch is full
        if len(photos_batch) >= batch_size:
            db.execute(text("""
                INSERT INTO photos (id, storage_provider, provider_photo_id, filename, mime_type, file_size, width, height, captured_at, indexed_at, md5, phash, phash_part1, phash_part2, phash_part3, phash_part4, clip_embedding, category, category_confidence)
                VALUES (:id, :storage_provider, :provider_photo_id, :filename, :mime_type, :file_size, :width, :height, :captured_at, :indexed_at, :md5, CAST(:phash AS bit(64)), :phash_part1, :phash_part2, :phash_part3, :phash_part4, :clip_embedding, :category, :category_confidence)
            """), photos_batch)
            photos_batch = []
            
            if faces_batch:
                db.execute(text("""
                    INSERT INTO faces (photo_id, box_x1, box_y1, box_x2, box_y2, embedding, face_cluster_id)
                    VALUES (:photo_id, :box_x1, :box_y1, :box_x2, :box_y2, :embedding, :face_cluster_id)
                """), faces_batch)
                faces_batch = []
            
        if i % 20000 == 0:
            db.commit()
            logger.info(f"Seeded {i} photos...")
            
    # Flush remainders
    if photos_batch:
        db.execute(text("""
            INSERT INTO photos (id, storage_provider, provider_photo_id, filename, mime_type, file_size, width, height, captured_at, indexed_at, md5, phash, phash_part1, phash_part2, phash_part3, phash_part4, clip_embedding, category, category_confidence)
            VALUES (:id, :storage_provider, :provider_photo_id, :filename, :mime_type, :file_size, :width, :height, :captured_at, :indexed_at, :md5, CAST(:phash AS bit(64)), :phash_part1, :phash_part2, :phash_part3, :phash_part4, :clip_embedding, :category, :category_confidence)
        """), photos_batch)
        
    if faces_batch:
        db.execute(text("""
            INSERT INTO faces (photo_id, box_x1, box_y1, box_x2, box_y2, embedding, face_cluster_id)
            VALUES (:photo_id, :box_x1, :box_y1, :box_x2, :box_y2, :embedding, :face_cluster_id)
        """), faces_batch)
        
    db.commit()
    logger.info("Inserted photos and faces. Now building HNSW vector index and running DBSCAN clustering...")
    
    # Create HNSW vector index for CLIP embedding to support sub-10ms search query lookups
    # If the index already exists, this command does nothing.
    try:
        db.execute(text("CREATE INDEX IF NOT EXISTS photos_clip_idx ON photos USING hnsw (clip_embedding vector_cosine_ops);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS faces_emb_idx ON faces USING hnsw (embedding vector_cosine_ops);"))
        db.commit()
        logger.info("HNSW indexes built successfully.")
    except Exception as idx_err:
        db.rollback()
        logger.warning(f"Could not build HNSW index automatically (likely pgvector version or constraints): {idx_err}")
        
    # Trigger clustering in the background
    from backend.tasks import cluster_faces_task
    cluster_faces_task.delay()
    
    return {"message": f"Successfully seeded {count} benchmark photos and triggered face clustering."}

# Help helpers for seeding

def np_random_unit_vector(dims):
    vec = np.random.normal(0, 1, dims)
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec.tolist()
    return (vec / norm).tolist()

# ==========================================
# Mount React static files
# ==========================================
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    logger.info(f"Serving built React frontend from {STATIC_DIR}...")
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    
    @app.get("/{catchall:path}", include_in_schema=False)
    async def serve_frontend(catchall: str):
        if catchall.startswith("api/") or catchall.startswith("docs") or catchall.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="API route not found")
        # Serve index.html for client side routing
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
else:
    logger.warning("React build output directory 'backend/static' not found. API mode only.")
    @app.get("/")
    def root_fallback():
        return {"message": "AuraPhoto API is running. Build frontend with 'npm run build' to serve UI."}
