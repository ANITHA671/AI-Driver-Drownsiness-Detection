import os
import cv2
import numpy as np
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

try:
    import tensorflow as tf
    try:
        from .cnn_model import build_cnn_model, TENSORFLOW_AVAILABLE
    except (ImportError, ValueError):
        from cnn_model import build_cnn_model, TENSORFLOW_AVAILABLE
except ImportError:
    TENSORFLOW_AVAILABLE = False

def generate_synthetic_eye(is_closed: bool, size=(24, 24)) -> np.ndarray:
    """
    Generates a synthetic grayscale image of an eye (open or closed) 
    using OpenCV shapes to enable offline training out-of-the-box.
    """
    # Create empty black canvas
    img = np.zeros(size, dtype=np.uint8)
    h, w = size
    cx, cy = w // 2, h // 2
    
    # Add noise / background skin color variation
    img = cv2.randu(img, 20, 50)
    
    if is_closed:
        # Draw a horizontal/slightly curved line representing a closed eye
        pts = np.array([
            [cx - 8, cy - 1],
            [cx - 4, cy + 1],
            [cx, cy + 2],
            [cx + 4, cy + 1],
            [cx + 8, cy - 1]
        ], dtype=np.int32)
        cv2.polylines(img, [pts], isClosed=False, color=200, thickness=2)
        # Add eyelashes
        cv2.line(img, (cx - 4, cy + 1), (cx - 6, cy + 4), color=150, thickness=1)
        cv2.line(img, (cx + 4, cy + 1), (cx + 6, cy + 4), color=150, thickness=1)
    else:
        # Draw an ellipse representing an open eye
        cv2.ellipse(img, (cx, cy), (8, 5), 0, 0, 360, color=220, thickness=-1) # Sclera
        cv2.circle(img, (cx, cy), 3, color=80, thickness=-1) # Iris
        cv2.circle(img, (cx, cy), 1, color=20, thickness=-1) # Pupil
        # Eyelids
        cv2.ellipse(img, (cx, cy), (8, 5), 0, 0, 360, color=120, thickness=1)

    # Apply slight Gaussian Blur to make it realistic
    img = cv2.GaussianBlur(img, (3, 3), 0)
    return img

def generate_dataset(num_samples=1000):
    """
    Generates a full synthetic dataset of open and closed eyes.
    """
    x = []
    y = []
    
    half_samples = num_samples // 2
    
    # Generate open eyes
    for _ in range(half_samples):
        # Add tiny random translation/scale variations
        sz = np.random.randint(22, 26)
        eye = generate_synthetic_eye(is_closed=False, size=(sz, sz))
        eye = cv2.resize(eye, (24, 24))
        x.append(eye)
        y.append(0) # 0 = Open
        
    # Generate closed eyes
    for _ in range(half_samples):
        sz = np.random.randint(22, 26)
        eye = generate_synthetic_eye(is_closed=True, size=(sz, sz))
        eye = cv2.resize(eye, (24, 24))
        x.append(eye)
        y.append(1) # 1 = Closed
        
    x = np.array(x, dtype=np.float32) / 255.0
    x = np.expand_dims(x, axis=-1) # Add channel dimension
    y = np.array(y, dtype=np.float32)
    
    # Shuffle dataset
    indices = np.arange(len(x))
    np.random.shuffle(indices)
    x = x[indices]
    y = y[indices]
    
    return x, y

def train_model(save_path: str):
    """
    Compiles, trains, and saves the eye-state CNN classifier.
    """
    if not TENSORFLOW_AVAILABLE:
        logging.error("Cannot train model. TensorFlow/Keras is not installed.")
        return False
        
    logging.info("Generating synthetic eye training dataset...")
    x, y = generate_dataset(1200)
    
    # Split into train/validation
    split_idx = int(len(x) * 0.8)
    x_train, x_val = x[:split_idx], x[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]
    
    logging.info(f"Training shape: {x_train.shape}, Validation shape: {x_val.shape}")
    
    logging.info("Building custom lightweight CNN model...")
    model = build_cnn_model(input_shape=(24, 24, 1))
    
    logging.info("Starting model training (5 epochs)...")
    model.fit(
        x_train, y_train,
        validation_data=(x_val, y_val),
        epochs=5,
        batch_size=32,
        verbose=1
    )
    
    # Ensure save directory exists
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    logging.info(f"Saving trained CNN model to {save_path}...")
    model.save(save_path)
    logging.info("Training complete and model saved successfully!")
    return True

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MODEL_DIR = os.path.join(BASE_DIR, "data")
    save_file = os.path.join(MODEL_DIR, "drowsiness_cnn.h5")
    
    if TENSORFLOW_AVAILABLE:
        train_model(save_file)
    else:
        print("TensorFlow not available in the current environment. Run in environment with TensorFlow installed.")
