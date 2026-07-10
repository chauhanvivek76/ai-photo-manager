from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class SyncSourceCreate(BaseModel):
    source_type: str = Field(..., description="'local' or 'google_photos'")
    path: Optional[str] = Field(None, description="Local folder path or account name")

class SyncSourceResponse(BaseModel):
    id: int
    source_type: str
    path: Optional[str]
    status: str
    last_sync_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class PhotoResponse(BaseModel):
    id: int
    storage_provider: str
    provider_photo_id: str
    filename: str
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    captured_at: Optional[datetime] = None
    indexed_at: datetime
    category: Optional[str] = None
    category_confidence: Optional[float] = None

    class Config:
        from_attributes = True

class FaceResponse(BaseModel):
    id: int
    photo_id: int
    box_x1: float
    box_y1: float
    box_x2: float
    box_y2: float
    face_cluster_id: Optional[int] = None

    class Config:
        from_attributes = True

class FaceClusterResponse(BaseModel):
    id: int
    name: str
    cover_face_id: Optional[int] = None
    faces_count: int

    class Config:
        from_attributes = True

class DuplicatePair(BaseModel):
    photo1: PhotoResponse
    photo2: PhotoResponse
    distance: int = Field(..., description="Hamming distance for near-duplicates, or 0 for exact")

class DuplicateGroup(BaseModel):
    original: PhotoResponse
    duplicates: List[PhotoResponse]
    duplicate_type: str = Field(..., description="'exact' or 'near'")

class DashboardStats(BaseModel):
    total_photos: int
    by_category: Dict[str, int]
    exact_duplicates_count: int
    near_duplicates_count: int
    total_faces: int
    total_clusters: int

class SearchQuery(BaseModel):
    query: str
    limit: int = 30
