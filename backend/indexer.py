import os
import hashlib
import logging
import requests
from datetime import datetime
from PIL import Image
from sqlalchemy.orm import Session
from backend.models import Photo, SyncSource
from backend.config import settings

logger = logging.getLogger("photo-manager.indexer")

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}

# Predefined high-quality public domain images representing different categories for the Google Photos simulation
SIMULATED_PHOTOS = [
    # Documents / Receipts / Prescriptions
    {
        "id": "sim_doc_1",
        "filename": "tax_invoice_2026.jpg",
        "url": "https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/contrib/Receipt.png",
        "captured_at": datetime(2026, 3, 15, 14, 30)
    },
    {
        "id": "sim_doc_2",
        "filename": "medical_prescription.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Medical_prescription_slip.png",
        "captured_at": datetime(2026, 5, 20, 10, 15)
    },
    {
        "id": "sim_doc_3",
        "filename": "article_document.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/English-language-document.jpg",
        "captured_at": datetime(2026, 1, 10, 9, 0)
    },
    # Pets
    {
        "id": "sim_pet_1",
        "filename": "playful_dog.jpg",
        "url": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop",
        "captured_at": datetime(2026, 6, 1, 16, 20)
    },
    {
        "id": "sim_pet_2",
        "filename": "sleeping_cat.jpg",
        "url": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=800&auto=format&fit=crop",
        "captured_at": datetime(2026, 6, 2, 8, 45)
    },
    # Travel / Landscapes
    {
        "id": "sim_travel_1",
        "filename": "mountain_sunset.jpg",
        "url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop",
        "captured_at": datetime(2026, 7, 4, 20, 10)
    },
    {
        "id": "sim_travel_2",
        "filename": "tokyo_streets.jpg",
        "url": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop",
        "captured_at": datetime(2026, 4, 12, 21, 30)
    },
    # People (For face detection & recognition)
    # Using photos of faces to verify clustering
    {
        "id": "sim_people_1",
        "filename": "business_portrait_1.jpg",
        "url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop",  # Man face 1
        "captured_at": datetime(2026, 2, 28, 11, 0)
    },
    {
        "id": "sim_people_2",
        "filename": "business_portrait_2.jpg",
        "url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop",  # Man face 2
        "captured_at": datetime(2026, 2, 28, 11, 5)
    },
    {
        "id": "sim_people_3",
        "filename": "woman_portrait_1.jpg",
        "url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop",  # Woman face 1
        "captured_at": datetime(2026, 3, 2, 10, 0)
    },
    {
        "id": "sim_people_4",
        "filename": "woman_portrait_2.jpg",
        "url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=800&auto=format&fit=crop",  # Woman face 2 (different woman)
        "captured_at": datetime(2026, 3, 2, 10, 30)
    },
    {
        "id": "sim_people_5",
        "filename": "group_selfie.jpg",
        "url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop",  # Group photo (should detect multiple faces)
        "captured_at": datetime(2026, 5, 5, 18, 0)
    }
]

def get_file_md5(filepath: str) -> str:
    """Calculate MD5 checksum of a file."""
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            hasher.update(chunk)
    return hasher.hexdigest()

def scan_local_directory(db: Session, sync_source_id: int):
    """Scan local directory for new image files and register them in the database."""
    source = db.query(SyncSource).filter(SyncSource.id == sync_source_id).first()
    if not source:
        logger.error(f"SyncSource {sync_source_id} not found.")
        return
    
    source.status = "syncing"
    db.commit()
    
    directory = source.path
    if not os.path.exists(directory):
        source.status = "failed"
        source.error_message = f"Directory '{directory}' does not exist on disk."
        db.commit()
        return
        
    from backend.tasks import process_photo_task
    
    new_photos_count = 0
    try:
        for root, _, files in os.walk(directory):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in IMAGE_EXTENSIONS:
                    filepath = os.path.abspath(os.path.join(root, file))
                    
                    # Check if already indexed
                    existing = db.query(Photo).filter(Photo.provider_photo_id == filepath).first()
                    if not existing:
                        try:
                            # Load basic metadata
                            stat = os.stat(filepath)
                            file_size = stat.st_size
                            
                            # Standard image dimensions and capture time
                            captured_at = datetime.fromtimestamp(stat.st_mtime)
                            
                            try:
                                with Image.open(filepath) as img:
                                    width, height = img.size
                                    # Try to read EXIF date
                                    exif = img._getexif() if hasattr(img, '_getexif') else None
                                    if exif and 36867 in exif: # DateTimeOriginal tag
                                        exif_date = exif[36867]
                                        try:
                                            captured_at = datetime.strptime(exif_date, "%Y:%m:%d %H:%M:%S")
                                        except Exception:
                                            pass
                            except Exception:
                                width, height = None, None
                            
                            # Create entry in database (pending processing)
                            new_photo = Photo(
                                storage_provider="local",
                                provider_photo_id=filepath,
                                filename=file,
                                mime_type=f"image/{ext[1:]}",
                                file_size=file_size,
                                width=width,
                                height=height,
                                captured_at=captured_at
                            )
                            db.add(new_photo)
                            db.flush()  # Populate id
                            
                            # Queue background AI processing task
                            process_photo_task.delay(new_photo.id)
                            new_photos_count += 1
                            
                        except Exception as e:
                            logger.error(f"Failed to index file metadata {filepath}: {e}")
                            
        source.status = "completed"
        source.last_sync_at = datetime.utcnow()
        source.error_message = None
        db.commit()
        logger.info(f"Local directory scan completed. Queued {new_photos_count} new photos for processing.")
        
    except Exception as e:
        db.rollback()
        source.status = "failed"
        source.error_message = f"Error during scanning: {str(e)}"
        db.commit()
        logger.error(f"Error scanning local directory {directory}: {e}")

def sync_google_photos_library(db: Session, sync_source_id: int, access_token: str = None, simulate: bool = False):
    """
    Sync user's Google Photos library.
    If simulate=True, loads predefined high-quality public domain images.
    """
    source = db.query(SyncSource).filter(SyncSource.id == sync_source_id).first()
    if not source:
        logger.error(f"SyncSource {sync_source_id} not found.")
        return
        
    source.status = "syncing"
    db.commit()
    
    from backend.tasks import process_photo_task
    
    new_photos_count = 0
    try:
        if simulate:
            logger.info("Starting simulated Google Photos sync...")
            for sim in SIMULATED_PHOTOS:
                existing = db.query(Photo).filter(Photo.provider_photo_id == sim["id"]).first()
                if not existing:
                    new_photo = Photo(
                        storage_provider="google_photos",
                        provider_photo_id=sim["id"],
                        filename=sim["filename"],
                        mime_type="image/jpeg",
                        # We store the download URL temporarily or use it to fetch image on worker
                        file_size=0,
                        width=None,
                        height=None,
                        captured_at=sim["captured_at"]
                    )
                    db.add(new_photo)
                    db.flush()
                    
                    # Queue worker to download and process
                    process_photo_task.delay(new_photo.id, download_url=sim["url"])
                    new_photos_count += 1
            
            source.status = "completed"
            source.last_sync_at = datetime.utcnow()
            source.error_message = None
            db.commit()
            logger.info(f"Simulated sync complete. Queued {new_photos_count} simulated images.")
            return

        # Real Google Photos API sync
        if not access_token:
            raise ValueError("Access token is required for Google Photos API sync.")
            
        logger.info("Starting real Google Photos API sync...")
        url = 'https://photoslibrary.googleapis.com/v1/mediaItems'
        headers = {'Authorization': f'Bearer {access_token}'}
        params = {'pageSize': 50}
        
        has_more = True
        page_token = None
        
        while has_more:
            if page_token:
                params['pageToken'] = page_token
                
            response = requests.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise Exception(f"Google Photos API returned error: {response.text}")
                
            data = response.json()
            media_items = data.get('mediaItems', [])
            
            for item in media_items:
                # Only check image media items
                mime_type = item.get('mimeType', '')
                if not mime_type.startswith('image/'):
                    continue
                    
                photo_id = item.get('id')
                filename = item.get('filename')
                
                # Check if already indexed
                existing = db.query(Photo).filter(Photo.provider_photo_id == photo_id).first()
                if not existing:
                    # Parse capture time
                    meta = item.get('mediaMetadata', {})
                    creation_time_str = meta.get('creationTime')
                    captured_at = datetime.utcnow()
                    if creation_time_str:
                        try:
                            # format usually ISO 8601: "2014-10-02T15:01:23.045Z"
                            captured_at = datetime.strptime(creation_time_str.split('.')[0].replace('Z', ''), "%Y-%m-%dT%H:%M:%S")
                        except Exception:
                            pass
                            
                    width = int(meta.get('width', 0)) or None
                    height = int(meta.get('height', 0)) or None
                    
                    # Store media item URL with moderate resolution sizing query parameter (=w1024-h1024)
                    base_url = item.get('baseUrl')
                    download_url = f"{base_url}=w1024-h1024" if base_url else None
                    
                    new_photo = Photo(
                        storage_provider="google_photos",
                        provider_photo_id=photo_id,
                        filename=filename,
                        mime_type=mime_type,
                        file_size=None,
                        width=width,
                        height=height,
                        captured_at=captured_at
                    )
                    db.add(new_photo)
                    db.flush()
                    
                    # Queue background worker with custom download URL
                    process_photo_task.delay(new_photo.id, download_url=download_url)
                    new_photos_count += 1
                    
            page_token = data.get('nextPageToken')
            if not page_token or new_photos_count >= 1000:  # Safety cap for single sync batch
                has_more = False
                
        source.status = "completed"
        source.last_sync_at = datetime.utcnow()
        source.error_message = None
        db.commit()
        logger.info(f"Google Photos Sync completed. Queued {new_photos_count} new photos.")
        
    except Exception as e:
        db.rollback()
        source.status = "failed"
        source.error_message = f"Error during Google Photos Sync: {str(e)}"
        db.commit()
        logger.error(f"Error syncing Google Photos source {sync_source_id}: {e}")
