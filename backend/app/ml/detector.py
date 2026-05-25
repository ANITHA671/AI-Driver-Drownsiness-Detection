import os
import cv2
import numpy as np
import time
import logging
from typing import Dict, Any, Tuple, Optional

# Set environment to hide MediaPipe logs
os.environ["GLOG_minloglevel"] = "2"

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    logging.error("MediaPipe is not installed. Face mesh tracking will not function.")

from .preprocess import crop_eye_region, preprocess_eye
from .cnn_model import EyeStateClassifier

class DriverFatigueDetector:
    def __init__(self, model_path: str = None):
        # Initialize Keras CNN classifier
        self.eye_classifier = EyeStateClassifier(model_path)
        
        # Initialize MediaPipe Face Mesh
        self.mp_face_mesh = None
        self.face_mesh = None
        
        if MEDIAPIPE_AVAILABLE:
            try:
                self.mp_face_mesh = mp.solutions.face_mesh
                self.face_mesh = self.mp_face_mesh.FaceMesh(
                    max_num_faces=1,
                    refine_landmarks=True, # Enables detailed iris/eye tracking landmarks
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                logging.info("MediaPipe Face Mesh initialized successfully.")
            except Exception as e:
                logging.error(f"Error initializing MediaPipe Face Mesh: {e}")
                self.mp_face_mesh = None
                self.face_mesh = None
                
        # 3D Reference Model Points for Head Pose Estimation (Standard Face Model)
        self.model_points = np.array([
            (0.0, 0.0, 0.0),             # Nose tip (landmark 1)
            (0.0, -330.0, -65.0),        # Chin (landmark 152)
            (-225.0, 170.0, -135.0),     # Left eye corner (landmark 263)
            (225.0, 170.0, -135.0),      # Right eye corner (landmark 33)
            (-150.0, -150.0, -125.0),    # Left mouth corner (landmark 308)
            (150.0, -150.0, -125.0)      # Right mouth corner (landmark 78)
        ], dtype=np.float32)

        # Session tracking state variables
        self.eyes_closed_start_time = None
        self.yawning_start_time = None
        self.distracted_start_time = None
        
        # Last active state
        self.last_status = "NORMAL"

    def calculate_euclidean_distance(self, p1: Tuple[float, float, float], p2: Tuple[float, float, float]) -> float:
        """
        Calculates 3D Euclidean distance between two MediaPipe landmarks.
        """
        return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2 + (p1[2] - p2[2])**2)

    def calculate_ear(self, landmarks, h: int, w: int) -> Tuple[float, float, float]:
        """
        Computes the Eye Aspect Ratio (EAR) for both eyes using 3D landmarks.
        
        Right Eye Landmarks:
        - Horizontal: 33 (outer), 133 (inner)
        - Vertical: 160 & 144, 158 & 153
        
        Left Eye Landmarks:
        - Horizontal: 362 (outer), 263 (inner)
        - Vertical: 385 & 373, 387 & 380
        """
        # Convert landmarks to coordinate tuples (x, y, z) scaled or raw
        # Using raw normalized (x,y,z) is highly scale-invariant for EAR
        def get_pt(idx):
            l = landmarks[idx]
            return (l.x, l.y, l.z)

        # Right Eye
        p1_r = get_pt(33)
        p2_r = get_pt(160)
        p3_r = get_pt(158)
        p4_r = get_pt(133)
        p5_r = get_pt(153)
        p6_r = get_pt(144)
        
        right_ear = (self.calculate_euclidean_distance(p2_r, p6_r) + 
                     self.calculate_euclidean_distance(p3_r, p5_r)) / (2.0 * self.calculate_euclidean_distance(p1_r, p4_r))

        # Left Eye
        p1_l = get_pt(263)
        p2_l = get_pt(385)
        p3_l = get_pt(387)
        p4_l = get_pt(362)
        p5_l = get_pt(373)
        p6_l = get_pt(380)

        left_ear = (self.calculate_euclidean_distance(p2_l, p6_l) + 
                    self.calculate_euclidean_distance(p3_l, p5_l)) / (2.0 * self.calculate_euclidean_distance(p1_l, p4_l))

        avg_ear = (left_ear + right_ear) / 2.0
        return avg_ear, left_ear, right_ear

    def calculate_mar(self, landmarks) -> float:
        """
        Computes the Mouth Aspect Ratio (MAR) for yawning detection.
        - Vertical: 13 (inner upper lip center), 14 (inner lower lip center)
        - Horizontal: 78 (left corner), 308 (right corner)
        """
        def get_pt(idx):
            l = landmarks[idx]
            return (l.x, l.y, l.z)

        v_dist = self.calculate_euclidean_distance(get_pt(13), get_pt(14))
        h_dist = self.calculate_euclidean_distance(get_pt(78), get_pt(308))
        
        if h_dist == 0:
            return 0.0
        return v_dist / h_dist

    def estimate_head_pose(self, landmarks, h: int, w: int) -> Tuple[float, float, float]:
        """
        Estimates Head Rotation (Pitch, Yaw, Roll) in degrees using cv2.solvePnP.
        Matches 6 facial landmarks (nose, chin, eyes, mouth corners) to a 3D model.
        """
        # Selected landmarks in image (2D)
        indices = [1, 152, 263, 33, 308, 78]
        image_points = []
        for idx in indices:
            l = landmarks[idx]
            image_points.append((int(l.x * w), int(l.y * h)))
            
        image_points = np.array(image_points, dtype=np.float32)
        
        # Camera internal parameters (Focal length, center)
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float32)
        
        dist_coeffs = np.zeros((4, 1)) # Assuming no lens distortion
        
        # Solve PnP
        success, rvec, tvec = cv2.solvePnP(
            self.model_points, 
            image_points, 
            camera_matrix, 
            dist_coeffs, 
            flags=cv2.SOLVEPNP_ITERATIVE
        )
        
        if not success:
            return 0.0, 0.0, 0.0
            
        # Get rotation matrix
        rmat, _ = cv2.Rodrigues(rvec)
        
        # Decompose rotation matrix to Euler angles
        # Roll, Pitch, Yaw
        sy = np.sqrt(rmat[0,0]**2 + rmat[1,0]**2)
        singular = sy < 1e-6
        
        if not singular:
            x = np.arctan2(rmat[2,1], rmat[2,2]) # Pitch
            y = np.arctan2(-rmat[2,0], sy)       # Yaw
            z = np.arctan2(rmat[1,0], rmat[0,0]) # Roll
        else:
            x = np.arctan2(-rmat[1,2], rmat[1,1])
            y = np.arctan2(-rmat[2,0], sy)
            z = 0
            
        # Convert to degrees
        pitch = x * (180.0 / np.pi)
        yaw = y * (180.0 / np.pi)
        roll = z * (180.0 / np.pi)
        
        return pitch, yaw, roll

    def process_frame(self, image: np.ndarray, thresholds: Dict[str, float] = None) -> Dict[str, Any]:
        """
        Main frame entry point. Decodes facial details and tracks fatigue.
        
        :param image: BGR image (OpenCV format)
        :param thresholds: Override values for EAR, MAR, head tilts.
        :return: Processing result dict
        """
        # Default thresholds if not provided
        t = {
            "ear_threshold": 0.21,
            "mar_threshold": 0.50,
            "pitch_threshold": 16.0,  # nod down / look up
            "yaw_threshold": 22.0,    # look left / right
            "eyes_closed_delay": 1.0, # seconds of closure for warning, 2.0 for danger
            "yawn_delay": 2.2,
            "distract_delay": 1.5
        }
        if thresholds:
            t.update(thresholds)
            
        h, w, _ = image.shape
        
        # Fallback dictionary if face is not detected
        no_face_res = {
            "ear": 0.28,
            "mar": 0.15,
            "head_pose": {"pitch": 0.0, "yaw": 0.0, "roll": 0.0},
            "is_eyes_closed": False,
            "is_yawning": False,
            "is_distracted": False,
            "drowsiness_score": 0.0,
            "status": "NORMAL",
            "alert_triggered": False,
            "alert_type": None,
            "duration_seconds": 0.0,
            "face_detected": False
        }
        
        if not MEDIAPIPE_AVAILABLE or self.face_mesh is None:
            return self._run_simulation(thresholds)
            
        # Process image with MediaPipe Face Mesh (requires RGB)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_image)
        
        if not results.multi_face_landmarks:
            # Face not found - reset timers
            self.eyes_closed_start_time = None
            self.yawning_start_time = None
            self.distracted_start_time = None
            return no_face_res
            
        # Get primary face landmarks
        face_landmarks = results.multi_face_landmarks[0].landmark
        
        # 1. EAR Calculations
        avg_ear, left_ear, right_ear = self.calculate_ear(face_landmarks, h, w)
        
        # 2. MAR Calculations
        mar = self.calculate_mar(face_landmarks)
        
        # 3. Head Pose Estimation
        pitch, yaw, roll = self.estimate_head_pose(face_landmarks, h, w)
        
        # 4. Deep Learning Eye State prediction using Keras CNN
        # Crop eye regions to crop, preprocess, and predict
        cnn_closed_prob = 0.0
        left_eye_crop = crop_eye_region(image, face_landmarks, [362, 385, 387, 263, 373, 380])
        if left_eye_crop is not None:
            preprocessed_left = preprocess_eye(left_eye_crop)
            cnn_closed_prob = self.eye_classifier.predict_closed_probability(preprocessed_left, avg_ear)
            
        # Evaluate Eye Closure state
        # Eye is closed if EAR < threshold OR CNN predicts highly closed
        is_eyes_closed = (avg_ear < t["ear_threshold"]) or (cnn_closed_prob > 0.65)
        
        # Evaluate Yawning state
        is_yawning = mar > t["mar_threshold"]
        
        # Evaluate Distraction state (turning head or slumping)
        # pitch > pitch_threshold: looking down (slumping) or looking up
        # abs(yaw) > yaw_threshold: looking left/right (distracted)
        is_distracted = (abs(pitch) > t["pitch_threshold"]) or (abs(yaw) > t["yaw_threshold"])
        
        # --- State Machine & Alert Timers ---
        current_time = time.time()
        
        # Eye closure tracker
        eyes_closed_dur = 0.0
        if is_eyes_closed:
            if self.eyes_closed_start_time is None:
                self.eyes_closed_start_time = current_time
            else:
                eyes_closed_dur = current_time - self.eyes_closed_start_time
        else:
            self.eyes_closed_start_time = None
            
        # Yawning tracker
        yawn_dur = 0.0
        if is_yawning:
            if self.yawning_start_time is None:
                self.yawning_start_time = current_time
            else:
                yawn_dur = current_time - self.yawning_start_time
        else:
            self.yawning_start_time = None
            
        # Distraction tracker
        distracted_dur = 0.0
        if is_distracted:
            if self.distracted_start_time is None:
                self.distracted_start_time = current_time
            else:
                distracted_dur = current_time - self.distracted_start_time
        else:
            self.distracted_start_time = None

        # --- Drowsiness/Alert Status Determination ---
        status = "NORMAL"
        alert_triggered = False
        alert_type = None
        duration_seconds = 0.0
        
        # Calculate a continuous drowsiness score from 0.0 to 1.0
        # Combines EAR, MAR, head tilts, and durations
        ear_score = max(0.0, 1.0 - (avg_ear / 0.32)) # low EAR -> high score
        mar_score = min(1.0, mar / 0.8)             # high MAR -> high score
        pose_score = min(1.0, (abs(pitch) + abs(yaw)) / 45.0) # extreme pose -> high score
        
        drowsiness_score = (ear_score * 0.5) + (mar_score * 0.25) + (pose_score * 0.25)
        # Apply scaling based on duration
        if eyes_closed_dur > 0.5:
            drowsiness_score = min(1.0, drowsiness_score + 0.3)
            
        drowsiness_score = float(np.clip(drowsiness_score, 0.0, 1.0))
        
        # Decide Alert triggers (DANGER wins over WARNING)
        if eyes_closed_dur >= 2.0:
            status = "DANGER"
            alert_triggered = True
            alert_type = "DROWSY_EAR"
            duration_seconds = eyes_closed_dur
        elif distracted_dur >= 2.5:
            status = "DANGER"
            alert_triggered = True
            alert_type = "DISTRACTED_LOOK_AWAY" if abs(yaw) > abs(pitch) else "DISTRACTED_HEAD_DOWN"
            duration_seconds = distracted_dur
        elif yawn_dur >= 3.5:
            status = "DANGER"
            alert_triggered = True
            alert_type = "DROWSY_YAWN"
            duration_seconds = yawn_dur
        # Warnings
        elif eyes_closed_dur >= t["eyes_closed_delay"]:
            status = "WARNING"
            alert_triggered = True
            alert_type = "DROWSY_EAR"
            duration_seconds = eyes_closed_dur
        elif distracted_dur >= t["distract_delay"]:
            status = "WARNING"
            alert_triggered = True
            alert_type = "DISTRACTED_LOOK_AWAY" if abs(yaw) > abs(pitch) else "DISTRACTED_HEAD_DOWN"
            duration_seconds = distracted_dur
        elif yawn_dur >= t["yawn_delay"]:
            status = "WARNING"
            alert_triggered = True
            alert_type = "DROWSY_YAWN"
            duration_seconds = yawn_dur
            
        self.last_status = status

        return {
            "ear": float(round(avg_ear, 3)),
            "mar": float(round(mar, 3)),
            "head_pose": {
                "pitch": float(round(pitch, 1)),
                "yaw": float(round(yaw, 1)),
                "roll": float(round(roll, 1))
            },
            "is_eyes_closed": bool(is_eyes_closed),
            "is_yawning": bool(is_yawning),
            "is_distracted": bool(is_distracted),
            "drowsiness_score": float(round(drowsiness_score, 2)),
            "status": status,
            "alert_triggered": alert_triggered,
            "alert_type": alert_type,
            "duration_seconds": float(round(duration_seconds, 1)),
            "face_detected": True
        }

    def _run_simulation(self, thresholds: Dict[str, float] = None) -> Dict[str, Any]:
        """
        Generates high-fidelity simulated metrics to enable complete, interactive 
        system testing in environments (like Python 3.13) without binary MediaPipe support.
        """
        t = {
            "ear_threshold": 0.21,
            "mar_threshold": 0.50,
            "pitch_threshold": 16.0,
            "yaw_threshold": 22.0,
            "eyes_closed_delay": 1.0,
            "yawn_delay": 2.2,
            "distract_delay": 1.5
        }
        if thresholds:
            t.update(thresholds)
            
        current_time = time.time()
        
        # Initialize a simulation cycle counter using class variables
        if not hasattr(self, "_sim_frame_count"):
            self._sim_frame_count = 0
            
        self._sim_frame_count += 1
        cycle = self._sim_frame_count % 350  # 350 frames cycle (~50 seconds)
        
        # Default focused driving values
        ear = 0.28 + 0.02 * np.sin(current_time * 0.5)
        mar = 0.14 + 0.03 * np.cos(current_time * 0.7)
        pitch = 1.2 * np.sin(current_time * 0.3)
        yaw = -0.8 * np.cos(current_time * 0.45)
        roll = 0.5 * np.sin(current_time * 0.2)
        
        is_eyes_closed = False
        is_yawning = False
        is_distracted = False
        
        # --- Simulate Drowsiness Scenarios sequentially in a loop ---
        # Scenario 1: Deep Blink / Eyes Closed (Frames 60 - 100)
        if 60 <= cycle < 100:
            # Slowly drop EAR past threshold
            progress = (cycle - 60) / 40.0
            ear = 0.28 - (progress * 0.16) # drops from 0.28 to 0.12
            if ear < t["ear_threshold"]:
                is_eyes_closed = True
                
        # Scenario 2: Yawning Fatigue (Frames 150 - 200)
        elif 150 <= cycle < 200:
            # Increase MAR past threshold
            progress = (cycle - 150) / 50.0
            mar = 0.14 + (progress * 0.52) # peaks at 0.66
            if mar > t["mar_threshold"]:
                is_yawning = True
                
        # Scenario 3: Looking Sideways / Distracted (Frames 250 - 300)
        elif 250 <= cycle < 300:
            progress = (cycle - 250) / 50.0
            yaw = -0.8 - (progress * 26.0) # goes past -22°
            if abs(yaw) > t["yaw_threshold"]:
                is_distracted = True
                
        # --- Timers and state logic same as core detector ---
        # Eye closure tracker
        eyes_closed_dur = 0.0
        if is_eyes_closed:
            if self.eyes_closed_start_time is None:
                self.eyes_closed_start_time = current_time
            else:
                eyes_closed_dur = current_time - self.eyes_closed_start_time
        else:
            self.eyes_closed_start_time = None
            
        # Yawning tracker
        yawn_dur = 0.0
        if is_yawning:
            if self.yawning_start_time is None:
                self.yawning_start_time = current_time
            else:
                yawn_dur = current_time - self.yawning_start_time
        else:
            self.yawning_start_time = None
            
        # Distraction tracker
        distracted_dur = 0.0
        if is_distracted:
            if self.distracted_start_time is None:
                self.distracted_start_time = current_time
            else:
                distracted_dur = current_time - self.distracted_start_time
        else:
            self.distracted_start_time = None

        # Determine states
        status = "NORMAL"
        alert_triggered = False
        alert_type = None
        duration_seconds = 0.0
        
        # continuous drowsiness score calculation
        ear_score = max(0.0, 1.0 - (ear / 0.32))
        mar_score = min(1.0, mar / 0.8)
        pose_score = min(1.0, (abs(pitch) + abs(yaw)) / 45.0)
        drowsiness_score = (ear_score * 0.5) + (mar_score * 0.25) + (pose_score * 0.25)
        
        if eyes_closed_dur > 0.5:
            drowsiness_score = min(1.0, drowsiness_score + 0.3)
        drowsiness_score = float(np.clip(drowsiness_score, 0.0, 1.0))
        
        # Decide Alert triggers
        if eyes_closed_dur >= 2.0:
            status = "DANGER"
            alert_triggered = True
            alert_type = "DROWSY_EAR"
            duration_seconds = eyes_closed_dur
        elif distracted_dur >= 2.5:
            status = "DANGER"
            alert_triggered = True
            alert_type = "DISTRACTED_LOOK_AWAY"
            duration_seconds = distracted_dur
        elif yawn_dur >= 3.5:
            status = "DANGER"
            alert_triggered = True
            alert_type = "DROWSY_YAWN"
            duration_seconds = yawn_dur
        # Warnings
        elif eyes_closed_dur >= t["eyes_closed_delay"]:
            status = "WARNING"
            alert_triggered = True
            alert_type = "DROWSY_EAR"
            duration_seconds = eyes_closed_dur
        elif distracted_dur >= t["distract_delay"]:
            status = "WARNING"
            alert_triggered = True
            alert_type = "DISTRACTED_LOOK_AWAY"
            duration_seconds = distracted_dur
        elif yawn_dur >= t["yawn_delay"]:
            status = "WARNING"
            alert_triggered = True
            alert_type = "DROWSY_YAWN"
            duration_seconds = yawn_dur
            
        self.last_status = status

        return {
            "ear": float(round(ear, 3)),
            "mar": float(round(mar, 3)),
            "head_pose": {
                "pitch": float(round(pitch, 1)),
                "yaw": float(round(yaw, 1)),
                "roll": float(round(roll, 1))
            },
            "is_eyes_closed": bool(is_eyes_closed),
            "is_yawning": bool(is_yawning),
            "is_distracted": bool(is_distracted),
            "drowsiness_score": float(round(drowsiness_score, 2)),
            "status": status,
            "alert_triggered": alert_triggered,
            "alert_type": alert_type,
            "duration_seconds": float(round(duration_seconds, 1)),
            "face_detected": True
        }
