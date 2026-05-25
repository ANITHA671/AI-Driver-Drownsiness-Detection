import os
import sys
import logging

# Get absolute path to backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Inject backend directory to sys.path and child environment PYTHONPATH
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)
os.environ["PYTHONPATH"] = BASE_DIR + os.pathsep + os.environ.get("PYTHONPATH", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def check_and_train_model():
    """
    Checks if the Keras eye classifier weights exist. If missing, auto-trains the CNN.
    """
    model_path = os.path.join(BASE_DIR, "data", "drowsiness_cnn.h5")
    
    if os.path.exists(model_path):
        logging.info(f"Eye state CNN weights found at {model_path}. Ready for deployment.")
        return
        
    logging.info("Trained eye state weights (.h5) not found. Checking TensorFlow to compile model...")
    try:
        from app.ml.trainer import train_model, TENSORFLOW_AVAILABLE
        
        if TENSORFLOW_AVAILABLE:
            logging.info("TensorFlow is available! Starting automated eye model training...")
            success = train_model(model_path)
            if success:
                logging.info("Model auto-training completed successfully.")
            else:
                logging.warning("Model training failed. Backend will run in fallback tracking mode.")
        else:
            logging.warning("TensorFlow is not installed in the environment. System will operate using high-fidelity facial tracking mode.")
    except Exception as e:
        logging.error(f"Error checking/training CNN model: {e}. System will run using facial tracking mode.")

if __name__ == "__main__":
    # Ensure dependencies are loaded
    check_and_train_model()
    
    import uvicorn
    logging.info("Starting Driver Drowsiness Detection System Backend Server on http://localhost:8088...")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8088, reload=True)
