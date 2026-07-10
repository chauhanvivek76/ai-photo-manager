import imagehash
import numpy as np
from PIL import Image, ImageEnhance
from backend.tasks import process_photo_task

def test_phash_near_duplicate_detection():
    # 1. Generate base random image
    np.random.seed(42)
    img_data = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
    base_img = Image.fromarray(img_data)
    
    # 2. Generate a slightly modified version (change brightness)
    enhancer = ImageEnhance.Brightness(base_img)
    modified_img = enhancer.enhance(1.1)  # Increase brightness by 10%
    
    # 3. Generate a completely different image
    diff_img_data = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
    diff_img = Image.fromarray(diff_img_data)
    
    # Compute perceptual hashes
    hash_base = imagehash.phash(base_img)
    hash_mod = imagehash.phash(modified_img)
    hash_diff = imagehash.phash(diff_img)
    
    # Hamming distance between base and modified should be very small (often 0 or 1-2 bits)
    dist_near = hash_base - hash_mod
    assert dist_near <= 4
    
    # Hamming distance between base and different should be large (typically > 12 bits)
    dist_far = hash_base - hash_diff
    assert dist_far > 10

def test_multi_index_hashing_pigeonhole():
    """
    Verifies that if Hamming Distance <= 4, the hashes match exactly 
    in at least one of their 4 segments (Multi-Index Hashing Pigeonhole principle).
    """
    # Create two hashes with Hamming distance of 3
    # 64-bit hex hash 1: "f0f0f0f0f0f0f0f0"
    # 64-bit hex hash 2: "f0f0f0f0f0f0f0f7" (differs by last 3 bits in the 4th block)
    hex1 = "f0f0f0f0f0f0f0f0"
    hex2 = "f0f0f0f0f0f0f0f7"
    
    # Convert to imagehash objects and check distance
    hash1 = imagehash.hex_to_hash(hex1)
    hash2 = imagehash.hex_to_hash(hex2)
    assert hash1 - hash2 == 3
    
    # Split into 4 parts of 4 hex chars (16 bits each)
    p1_1, p1_2, p1_3, p1_4 = int(hex1[0:4], 16), int(hex1[4:8], 16), int(hex1[8:12], 16), int(hex1[12:16], 16)
    p2_1, p2_2, p2_3, p2_4 = int(hex2[0:4], 16), int(hex2[4:8], 16), int(hex2[8:12], 16), int(hex2[12:16], 16)
    
    # Verify the Pigeonhole Principle holds: at least one segment matches exactly
    matches = [
        p1_1 == p2_1,
        p1_2 == p2_2,
        p1_3 == p2_3,
        p1_4 == p2_4
    ]
    
    assert any(matches)
    # The first 3 parts must match exactly
    assert matches[0] is True
    assert matches[1] is True
    assert matches[2] is True
    assert matches[3] is False  # The last one differs
