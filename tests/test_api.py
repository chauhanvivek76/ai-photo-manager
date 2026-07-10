import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database import Base, get_db, init_db
from backend.models import SyncSource, Photo

# Setup test client
client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data

def test_sync_sources_lifecycle():
    # 1. Create source
    payload = {
        "source_type": "local",
        "path": "/photos/test_directory"
    }
    response = client.post("/api/v1/sync-sources", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["source_type"] == "local"
    assert data["path"] == "/photos/test_directory"
    assert data["status"] == "idle"
    source_id = data["id"]
    
    # 2. Get list of sources
    get_res = client.get("/api/v1/sync-sources")
    assert get_res.status_code == 200
    sources = get_res.json()
    assert any(s["id"] == source_id for s in sources)
    
    # 3. Clean up (delete source)
    del_res = client.delete(f"/api/v1/sync-sources/{source_id}")
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Sync source deleted successfully."

def test_dashboard_stats_endpoint():
    response = client.get("/api/v1/dashboard/stats")
    assert response.status_code == 200
    stats = response.json()
    assert "total_photos" in stats
    assert "by_category" in stats
    assert "exact_duplicates_count" in stats
    assert "near_duplicates_count" in stats
    assert "total_faces" in stats
    assert "total_clusters" in stats

def test_photos_list_pagination():
    response = client.get("/api/v1/photos?page=1&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "photos" in data
    assert "page" in data
    assert "limit" in data
    assert len(data["photos"]) <= 5
