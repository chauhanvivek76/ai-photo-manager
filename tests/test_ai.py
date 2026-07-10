import pytest
import numpy as np
from PIL import Image
from backend.ai_models import (
    classify_image, 
    get_image_embedding, 
    get_text_embedding, 
    cluster_face_embeddings
)

def test_clip_embeddings_and_classification():
    # Create a small random RGB image for testing
    img_data = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    img = Image.fromarray(img_data)
    
    # 1. Test Zero-shot Classification
    category, confidence = classify_image(img)
    assert category in ["document", "prescription", "receipt", "people", "travel", "pets", "other"]
    assert 0.0 <= confidence <= 1.0
    
    # 2. Test Image Embedding Extraction
    img_emb = get_image_embedding(img)
    assert isinstance(img_emb, list)
    assert len(img_emb) == 512
    # Verify it is normalized
    assert pytest.approx(np.linalg.norm(img_emb), abs=1e-4) == 1.0

    # 3. Test Text Embedding Extraction
    text_emb = get_text_embedding("sunset over mountains")
    assert isinstance(text_emb, list)
    assert len(text_emb) == 512
    assert pytest.approx(np.linalg.norm(text_emb), abs=1e-4) == 1.0

def test_face_dbscan_clustering():
    # Generate mock 512-dimensional face vectors
    # 3 vectors close to base_1 (Person A)
    # 2 vectors close to base_2 (Person B)
    base_1 = np.random.normal(0, 1, 512)
    base_1 = base_1 / np.linalg.norm(base_1)
    
    base_2 = np.random.normal(0, 1, 512)
    base_2 = base_2 / np.linalg.norm(base_2)
    
    # Ensure bases are different enough
    while np.linalg.norm(base_1 - base_2) < 0.8:
        base_2 = np.random.normal(0, 1, 512)
        base_2 = base_2 / np.linalg.norm(base_2)
        
    v1 = base_1 + np.random.normal(0, 0.05, 512)
    v2 = base_1 + np.random.normal(0, 0.05, 512)
    v3 = base_1 + np.random.normal(0, 0.05, 512)
    
    v4 = base_2 + np.random.normal(0, 0.05, 512)
    v5 = base_2 + np.random.normal(0, 0.05, 512)
    
    # Normalize vectors
    vectors = [v / np.linalg.norm(v) for v in [v1, v2, v3, v4, v5]]
    
    faces_list = [
        (101, vectors[0].tolist()),
        (102, vectors[1].tolist()),
        (103, vectors[2].tolist()),
        (104, vectors[3].tolist()),
        (105, vectors[4].tolist())
    ]
    
    # Run clustering (eps=0.55 should separate them into 2 clusters, minimum sample size=2)
    clusters = cluster_face_embeddings(faces_list, eps=0.55, min_samples=2)
    
    # Verify that:
    # 101, 102, 103 share the same cluster label
    # 104, 105 share the same cluster label
    # The cluster labels are different
    assert clusters[101] == clusters[102] == clusters[103]
    assert clusters[104] == clusters[105]
    assert clusters[101] != clusters[104]
    assert clusters[101] >= 0
    assert clusters[104] >= 0
