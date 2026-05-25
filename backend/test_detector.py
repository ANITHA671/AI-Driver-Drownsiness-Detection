import os
import sys
import numpy as np
import cv2

# Set path to import app modules
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app.ml.detector import DriverFatigueDetector
from app.ml.cnn_model import TENSORFLOW_AVAILABLE

def test_ml_pipeline():
    print("==================================================")
    print("         ML DETECTOR UNIT VERIFICATION             ")
    print("==================================================")
    
    # 1. Initialize Detector
    model_path = os.path.join(BASE_DIR, "data", "drowsiness_cnn.h5")
    print(f"[*] Initializing Fatigue Detector (Weights: {model_path})...")
    detector = DriverFatigueDetector(model_path=model_path)
    
    # 2. Check TensorFlow availability
    print(f"[*] Neural Network Engine: {'TENSORFLOW (Keras Enabled)' if TENSORFLOW_AVAILABLE else 'Facial Tracking fallback (High-Fidelity)'}")
    
    # 3. Create dummy driver frame (black image represents empty view, which should return no face)
    print("[*] Generating empty camera frame (No face)...")
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    print("[*] Feeding frame to detector pipeline...")
    result = detector.process_frame(dummy_frame)
    
    # 4. Verify outputs
    print("[+] Test Completed Successfully!")
    print("--------------------------------------------------")
    print(f"Face Spotted : {result['face_detected']}")
    print(f"Safety Status: {result['status']}")
    print(f"EAR Value    : {result['ear']}")
    print(f"MAR Value    : {result['mar']}")
    print(f"Pitch Tilt   : {result['head_pose']['pitch']}°")
    print(f"Yaw Turn     : {result['head_pose']['yaw']}°")
    print(f"Fatigue Score: {result['drowsiness_score']}")
    print("--------------------------------------------------")
    
    # Assert return types are consistent
    assert isinstance(result["ear"], float), "EAR should be a float"
    assert isinstance(result["mar"], float), "MAR should be a float"
    assert isinstance(result["status"], str), "Status should be a string"
    assert result["face_detected"] is False, "Should report false face spot for black frame"
    
    print("[SUCCESS] All core ML metrics returned correct formats!")
    print("==================================================")

if __name__ == "__main__":
    try:
        test_ml_pipeline()
    except Exception as e:
        print(f"[CRITICAL ERROR] Pipeline verification failed: {e}")
        sys.exit(1)
