from sqlalchemy import Column, Integer, String, BigInteger, Float, DateTime, ForeignKey, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import BIT
from pgvector.sqlalchemy import Vector
from datetime import datetime
from backend.database import Base

class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    storage_provider = Column(String(50), nullable=False)  # 'local' or 'google_photos'
    provider_photo_id = Column(String(500), nullable=False, unique=True, index=True)  # File path or Google Photos API media ID
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    captured_at = Column(DateTime, nullable=True, index=True)
    indexed_at = Column(DateTime, default=datetime.utcnow)
    
    # Duplicate detection keys
    md5 = Column(String(32), nullable=True, index=True)  # MD5 of image data
    phash = Column(BIT(64), nullable=True, index=True)   # Perceptual hash for near-duplicate search
    
    # 16-bit blocks for Multi-Index Hashing (MIH) to accelerate pHash searches
    phash_part1 = Column(Integer, nullable=True, index=True)
    phash_part2 = Column(Integer, nullable=True, index=True)
    phash_part3 = Column(Integer, nullable=True, index=True)
    phash_part4 = Column(Integer, nullable=True, index=True)
    
    # AI Categorization & Search
    clip_embedding = Column(Vector(512), nullable=True)  # Dense representation for vector search
    category = Column(String(50), nullable=True, index=True)  # 'document', 'receipt', 'prescription', 'people', etc.
    category_confidence = Column(Float, nullable=True)
    
    # Relationships
    faces = relationship("Face", back_populates="photo", cascade="all, delete-orphan")

class Face(Base):
    __tablename__ = "faces"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Normalized bounding box coordinates (0.0 to 1.0)
    box_x1 = Column(Float, nullable=False)
    box_y1 = Column(Float, nullable=False)
    box_x2 = Column(Float, nullable=False)
    box_y2 = Column(Float, nullable=False)
    
    # Face embedding (512-dimensional vector from FaceNet)
    embedding = Column(Vector(512), nullable=False)
    
    # Grouping / Clustering
    face_cluster_id = Column(Integer, ForeignKey("face_clusters.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Relationships
    photo = relationship("Photo", back_populates="faces")
    cluster = relationship("FaceCluster", back_populates="faces")

class FaceCluster(Base):
    __tablename__ = "face_clusters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # User given name or "Person ID"
    cover_face_id = Column(Integer, nullable=True)  # Reference to Face ID to use as cover thumbnail
    
    # Relationships
    faces = relationship("Face", back_populates="cluster")

class SyncSource(Base):
    __tablename__ = "sync_sources"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), nullable=False)  # 'local' or 'google_photos'
    path = Column(String(500), nullable=True, unique=True)  # Directory path or Google account name
    status = Column(String(50), default="idle")  # 'idle', 'syncing', 'completed', 'failed'
    last_sync_at = Column(DateTime, nullable=True)
    error_message = Column(String(500), nullable=True)
