import logging
import torch
import numpy as np
from PIL import Image
from sklearn.cluster import DBSCAN
from transformers import CLIPProcessor, CLIPModel
from facenet_pytorch import MTCNN, InceptionResnetV1

logger = logging.getLogger("photo-manager.ai")

# Lazy-loaded singletons
_clip_model = None
_clip_processor = None
_mtcnn = None
_resnet = None

def load_clip():
    global _clip_model, _clip_processor
    if _clip_model is None:
        logger.info("Loading CLIP model (openai/clip-vit-base-patch32)...")
        _clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        _clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _clip_model.eval()
    return _clip_model, _clip_processor

def load_face_models():
    global _mtcnn, _resnet
    if _mtcnn is None:
        logger.info("Loading Face Detection (MTCNN) and Recognition (InceptionResnetV1)...")
        # Initialize MTCNN for face detection (runs on CPU)
        _mtcnn = MTCNN(image_size=160, margin=20, keep_all=True, device='cpu')
        # Initialize ResNet for face embedding extraction
        _resnet = InceptionResnetV1(pretrained='vggface2', device='cpu').eval()
    return _mtcnn, _resnet

def get_image_embedding(image: Image.Image) -> list:
    """Extract 512-dimensional CLIP embedding from PIL Image."""
    model, processor = load_clip()
    # Convert image to RGB if not already
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
    # Extract pooler_output if it is a BaseModelOutput object (transformers v5)
    if hasattr(image_features, "pooler_output"):
        image_features = image_features.pooler_output
    # L2 normalize
    image_features = image_features / image_features.norm(dim=-1, keepdim=True)
    return image_features.cpu().numpy()[0].tolist()

def get_text_embedding(text: str) -> list:
    """Extract 512-dimensional CLIP embedding from a text string."""
    model, processor = load_clip()
    inputs = processor(text=[text], return_tensors="pt", padding=True)
    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
    # Extract pooler_output if it is a BaseModelOutput object (transformers v5)
    if hasattr(text_features, "pooler_output"):
        text_features = text_features.pooler_output
    # L2 normalize
    text_features = text_features / text_features.norm(dim=-1, keepdim=True)
    return text_features.cpu().numpy()[0].tolist()

def classify_image(image: Image.Image) -> tuple:
    """Classify image into pre-defined categories using CLIP zero-shot classification."""
    model, processor = load_clip()
    if image.mode != "RGB":
        image = image.convert("RGB")
        
    categories = ["document", "prescription", "receipt", "people", "travel", "pets", "other"]
    prompts = [
        "a photo of a text document, paper, article, book page, or PDF",
        "a photo of a medical prescription, Rx note, medicine bottle list, or medical letter",
        "a photo of a shopping receipt, restaurant bill, cash invoice, or checkout receipt",
        "a photo of people, friends, family, portrait, group photo, or a person",
        "a photo of travel, vacation scenery, architecture, nature landscape, outdoor scenery, or historic landmark",
        "a photo of a pet, dog, cat, domestic animal, or wildlife",
        "a photo of miscellaneous objects, screenshot, abstract pattern, or other scenes"
    ]
    
    mapping = {prompts[i]: categories[i] for i in range(len(categories))}
    
    inputs = processor(text=prompts, images=image, return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    
    logits_per_image = outputs.logits_per_image  # image-to-text similarity
    probs = logits_per_image.softmax(dim=-1).cpu().numpy()[0]
    
    max_idx = probs.argmax()
    best_prompt = prompts[max_idx]
    confidence = float(probs[max_idx])
    category_name = mapping[best_prompt]
    
    return category_name, confidence

def detect_and_embed_faces(image: Image.Image) -> list:
    """Detect all faces in an image and generate 512-dim embedding for each."""
    mtcnn, resnet = load_face_models()
    
    # Ensure image is RGB
    if image.mode != "RGB":
        image = image.convert("RGB")
        
    width, height = image.size
    
    # Detect faces
    try:
        boxes, probs = mtcnn.detect(image)
    except Exception as e:
        logger.error(f"Error during face detection: {e}")
        return []
        
    if boxes is None or len(boxes) == 0:
        return []
        
    results = []
    for i, box in enumerate(boxes):
        # Only accept high-confidence face detections
        if probs[i] is None or probs[i] < 0.8:
            continue
            
        x1, y1, x2, y2 = map(int, box)
        
        # Clip bounding box coordinates to image dimensions
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(width, x2), min(height, y2)
        
        # Check minimum face size
        if x2 - x1 < 20 or y2 - y1 < 20:
            continue
            
        try:
            # Crop, resize and normalize face for FaceNet
            face_img = image.crop((x1, y1, x2, y2)).resize((160, 160))
            face_arr = np.array(face_img).astype(np.float32)
            
            face_tensor = torch.tensor(face_arr).permute(2, 0, 1)  # shape: (3, 160, 160)
            # Normalize according to MTCNN specifications: (x - 127.5) / 128
            face_tensor = (face_tensor - 127.5) / 128.0
            face_tensor = face_tensor.unsqueeze(0)
            
            with torch.no_grad():
                emb = resnet(face_tensor)[0]
                
            normalized_box = [
                float(x1) / width,
                float(y1) / height,
                float(x2) / width,
                float(y2) / height
            ]
            
            results.append({
                "box": normalized_box,
                "embedding": emb.cpu().numpy().tolist()
            })
        except Exception as e:
            logger.error(f"Error extracting face embedding for box {box}: {e}")
            continue
            
    return results

def cluster_face_embeddings(faces_list: list, eps: float = 0.6, min_samples: int = 2) -> dict:
    """
    Cluster face embeddings using DBSCAN with a memory-safe hybrid projection algorithm.
    """
    if not faces_list:
        return {}
        
    face_ids = [item[0] for item in faces_list]
    X = np.array([item[1] for item in faces_list])
    
    N = len(faces_list)
    max_dbscan_samples = 3000
    
    if N <= max_dbscan_samples:
        dbscan = DBSCAN(eps=eps, min_samples=min_samples, metric='euclidean', n_jobs=-1)
        labels = dbscan.fit_predict(X)
    else:
        logger.info(f"Faces count {N} exceeds memory safety limit. Using hybrid centroid projection method.")
        X_sub = X[:max_dbscan_samples]
        dbscan = DBSCAN(eps=eps, min_samples=min_samples, metric='euclidean', n_jobs=-1)
        labels_sub = dbscan.fit_predict(X_sub)
        
        # Calculate centroids of identified clusters (excluding noise label -1)
        centroids = {}
        unique_labels = set(labels_sub)
        for label in unique_labels:
            if label == -1:
                continue
            members = X_sub[labels_sub == label]
            centroids[label] = members.mean(axis=0)
            
        labels = np.full(N, -1)
        labels[:max_dbscan_samples] = labels_sub
        
        if centroids:
            centroid_labels = list(centroids.keys())
            centroid_matrix = np.array([centroids[l] for l in centroid_labels])
            
            remainder_start = max_dbscan_samples
            X_rem = X[remainder_start:]
            
            batch_size = 5000
            for start in range(0, len(X_rem), batch_size):
                end = start + batch_size
                X_batch = X_rem[start:end]
                
                # Using algebraic expansion for memory-efficient and ultra-fast L2 distance
                # ||x - c||^2 = ||x||^2 + ||c||^2 - 2 * x . c^T
                x_sq = np.sum(X_batch ** 2, axis=1)[:, np.newaxis]
                c_sq = np.sum(centroid_matrix ** 2, axis=1)
                cross_term = 2 * np.dot(X_batch, centroid_matrix.T)
                sq_dists = np.clip(x_sq + c_sq - cross_term, a_min=0, a_max=None)
                dists = np.sqrt(sq_dists)
                
                min_indices = np.argmin(dists, axis=1)
                min_dists = np.min(dists, axis=1)
                
                batch_labels = np.full(len(X_batch), -1)
                within_eps = min_dists <= eps
                
                # Assign to nearest cluster centroid if within eps threshold
                for j in range(len(X_batch)):
                    if within_eps[j]:
                        batch_labels[j] = centroid_labels[min_indices[j]]
                
                labels[remainder_start + start : remainder_start + end] = batch_labels
                
    return {face_ids[i]: int(labels[i]) for i in range(len(face_ids))}
