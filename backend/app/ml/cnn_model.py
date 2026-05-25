import os
import logging
import numpy as np

# Configure minimal TF logs
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

try:
    import tensorflow as tf
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logging.warning("TensorFlow/Keras is not installed or available. Using high-fidelity landmark classification fallback.")

def build_cnn_model(input_shape=(24, 24, 1)):
    """
    Constructs a lightweight CNN model for eye-state (open/closed) prediction.
    """
    if not TENSORFLOW_AVAILABLE:
        raise ImportError("TensorFlow/Keras is required to build the CNN model.")
        
    model = tf.keras.models.Sequential([
        tf.keras.layers.Input(shape=input_shape),
        tf.keras.layers.Conv2D(16, (3, 3), activation="relu"),
        tf.keras.layers.MaxPooling2D((2, 2)),
        
        tf.keras.layers.Conv2D(32, (3, 3), activation="relu"),
        tf.keras.layers.MaxPooling2D((2, 2)),
        
        tf.keras.layers.Conv2D(64, (3, 3), activation="relu"),
        tf.keras.layers.MaxPooling2D((2, 2)),
        
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(1, activation="sigmoid")  # Output represents P(closed) - 1.0 is Closed, 0.0 is Open
    ])
    
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


class EyeStateClassifier:
    """
    Inference helper that wraps the Keras model. Includes a high-fidelity 
    fallback calculation based on local EAR when TensorFlow is unavailable.
    """
    def __init__(self, model_path: str = None):
        self.model = None
        self.model_path = model_path
        self.is_loaded = False
        
        if TENSORFLOW_AVAILABLE and model_path and os.path.exists(model_path):
            try:
                self.model = tf.keras.models.load_model(model_path)
                self.is_loaded = True
                logging.info(f"Successfully loaded Keras CNN eye-state model from {model_path}")
            except Exception as e:
                logging.error(f"Error loading Keras CNN model: {e}. Falling back to EAR classification.")
        else:
            if TENSORFLOW_AVAILABLE:
                logging.info("CNN model file not found. Running with high-fidelity landmark eye tracking.")
            else:
                logging.info("TensorFlow disabled. Running with high-fidelity landmark eye tracking.")

    def predict_closed_probability(self, preprocessed_eye: 'np.ndarray', local_ear: float) -> float:
        """
        Predicts the probability that an eye is closed.
        
        :param preprocessed_eye: Preprocessed 4D grayscale image array of the eye
        :param local_ear: The Eye Aspect Ratio (EAR) computed via MediaPipe landmarks
        :return: Float between 0.0 (Fully Open) and 1.0 (Fully Closed)
        """
        # If the deep learning model is loaded, run inference
        if self.is_loaded and self.model is not None:
            try:
                prediction = self.model.predict(preprocessed_eye, verbose=0)
                cnn_prob = float(prediction[0][0])
                # Ensemble: Combine CNN prediction with EAR physical state to prevent false negatives
                # If EAR is extremely high, the eye is clearly open, overwrite CNN
                if local_ear > 0.28:
                    return cnn_prob * 0.2
                # If EAR is extremely low, the eye is physically closed, enhance probability
                elif local_ear < 0.17:
                    return max(cnn_prob, 0.85)
                return cnn_prob
            except Exception as e:
                logging.error(f"CNN inference error: {e}. Relying on EAR.")
                
        # High-Fidelity Fallback Logic: Maps EAR (typically 0.14 - 0.35) to a probability [0, 1]
        # Fully open (EAR >= 0.28) -> 0.0 Closed Prob
        # Fully closed (EAR <= 0.18) -> 1.0 Closed Prob
        if local_ear >= 0.28:
            return 0.0
        elif local_ear <= 0.16:
            return 1.0
        else:
            # Linear mapping from [0.16, 0.28] to [1.0, 0.0]
            prob = 1.0 - ((local_ear - 0.16) / (0.28 - 0.16))
            return float(np.clip(prob, 0.0, 1.0))
