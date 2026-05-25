import cv2
import numpy as np

def crop_eye_region(image: np.ndarray, landmarks: list, eye_indices: list, padding: int = 4) -> np.ndarray:
    """
    Crops the eye region from the image given MediaPipe face landmarks and a list of eye indices.
    
    :param image: Input OpenCV BGR image
    :param landmarks: List of normalized MediaPipe landmark objects
    :param eye_indices: List of index positions of landmarks forming the eye
    :param padding: Pixel padding around the cropped bounding box
    :return: Cropped and grayscale eye image, or None if cropping fails
    """
    h, w = image.shape[:2]
    
    # Extract coordinates
    coords = []
    for idx in eye_indices:
        landmark = landmarks[idx]
        x = int(landmark.x * w)
        y = int(landmark.y * h)
        coords.append((x, y))
        
    coords = np.array(coords)
    
    # Calculate bounding box
    x_min, y_min = np.min(coords, axis=0)
    x_max, y_max = np.max(coords, axis=0)
    
    # Apply padding
    x_min = max(0, x_min - padding)
    y_min = max(0, y_min - padding)
    x_max = min(w, x_max + padding)
    y_max = min(h, y_max + padding)
    
    # Crop
    eye_crop = image[y_min:y_max, x_min:x_max]
    
    if eye_crop.size == 0:
        return None
        
    return eye_crop

def preprocess_eye(eye_crop: np.ndarray, target_size=(24, 24)) -> np.ndarray:
    """
    Resizes, grayscales, and normalizes a cropped eye image for input to the CNN model.
    
    :param eye_crop: BGR cropped eye image
    :param target_size: (width, height) for the CNN
    :return: Preprocessed 4D numpy array ready for Keras prediction
    """
    # Convert to grayscale
    gray = cv2.cvtColor(eye_crop, cv2.COLOR_BGR2GRAY)
    
    # Resize
    resized = cv2.resize(gray, target_size)
    
    # Normalize pixel values
    normalized = resized.astype(np.float32) / 255.0
    
    # Expand dimensions for deep learning (batch_size, height, width, channels)
    expanded = np.expand_dims(normalized, axis=-1)
    expanded = np.expand_dims(expanded, axis=0)
    
    return expanded
