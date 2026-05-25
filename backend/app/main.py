import os
import cv2
import base64
import json
import logging
import time
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, Base, get_db, SessionLocal
from .routers import sessions, stats
from .ml.detector import DriverFatigueDetector
from . import crud, schemas

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Initialize Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Driver Drowsiness Detection API",
    description="Backend API with deep learning eye closure and MediaPipe face mesh landmarks",
    version="1.0.0"
)

# Configure CORS for React/Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST Routers
app.include_router(sessions.router)
app.include_router(stats.router)

# Locate trained CNN model
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "data", "drowsiness_cnn.h5")

# Initialize Fatigue Detector
detector = DriverFatigueDetector(model_path=MODEL_PATH)

def base64_to_cv2(b64_string: str) -> np.ndarray:
    """
    Decodes a base64 encoded string containing an image into a BGR OpenCV image.
    """
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    
    image_bytes = base64.b64decode(b64_string)
    image_np = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(image_np, cv2.IMREAD_COLOR)


@app.get("/")
def read_root():
    return {
        "status": "ONLINE",
        "system": "Driver Drowsiness Detection System API",
        "version": "1.0.0"
    }


@app.websocket("/api/ws/detect")
async def websocket_detect(websocket: WebSocket):
    """
    WebSocket endpoint for real-time video stream fatigue processing.
    """
    await websocket.accept()
    logging.info("WebSocket connection established for fatigue detection.")
    
    # Track timers to avoid overloading SQLite
    last_telemetry_time = 0.0
    telemetry_interval = 2.0  # Log state variables to database every 2 seconds
    
    # Store currently active alert state to detect state boundaries
    # Avoids logging duplicate entries in database while alert is ongoing
    active_alert_type = None
    alert_start_time = None
    
    try:
        while True:
            # Receive frame data from client
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            session_id = payload.get("session_id")
            image_b64 = payload.get("image")
            thresholds = payload.get("thresholds", {})
            
            if not session_id or not image_b64:
                await websocket.send_json({"error": "Missing session_id or image data."})
                continue
                
            # Check if session exists in DB (using isolated session)
            db = SessionLocal()
            session_valid = False
            try:
                db_session = crud.get_session(db, session_id)
                session_valid = db_session is not None and db_session.status != "COMPLETED"
            finally:
                db.close()
                
            if not session_valid:
                await websocket.send_json({"error": "Session is inactive or not found."})
                continue
                
            # 1. Decode image
            start_proc_time = time.time()
            try:
                cv_image = base64_to_cv2(image_b64)
            except Exception as e:
                logging.error(f"Image base64 decoding error: {e}")
                await websocket.send_json({"error": "Invalid base64 image data."})
                continue
                
            if cv_image is None or cv_image.size == 0:
                await websocket.send_json({"error": "Decoded image is empty."})
                continue
                
            # 2. Process frame with detector
            result = detector.process_frame(cv_image, thresholds)
            
            # Calculate processing time & FPS
            proc_duration = time.time() - start_proc_time
            result["fps"] = round(1.0 / max(0.001, proc_duration), 1)
            result["timestamp"] = time.time()
            
            # --- Database Logging Orchestrator ---
            current_time = time.time()
            
            # A. Throttled Telemetry logging (Save stats to DB every N seconds)
            if current_time - last_telemetry_time >= telemetry_interval:
                db = SessionLocal()
                try:
                    telemetry_in = schemas.TelemetryCreate(
                        session_id=session_id,
                        ear=result["ear"],
                        mar=result["mar"],
                        head_pitch=result["head_pose"]["pitch"],
                        head_yaw=result["head_pose"]["yaw"],
                        drowsiness_score=result["drowsiness_score"],
                        is_drowsy=result["status"] in ["WARNING", "DANGER"]
                    )
                    crud.create_telemetry(db, telemetry_in)
                    last_telemetry_time = current_time
                except Exception as e:
                    logging.error(f"Database error writing telemetry: {e}")
                finally:
                    db.close()
                    
            # B. Edge-triggered Alert logging
            # Log alert when it turns from NORMAL -> WARNING/DANGER
            if result["alert_triggered"]:
                alert_type = result["alert_type"]
                severity = result["status"]
                
                # Check if this is a newly triggered alert or a level upgrade
                if active_alert_type != alert_type:
                    # Log the *previous* alert if it was active
                    if active_alert_type is not None and alert_start_time is not None:
                        # Update database or duration log
                        pass
                        
                    # Save new alert record to Database
                    db = SessionLocal()
                    try:
                        alert_in = schemas.AlertCreate(
                            session_id=session_id,
                            alert_type=alert_type,
                            severity=severity,
                            ear_value=result["ear"],
                            mar_value=result["mar"],
                            duration_seconds=result["duration_seconds"]
                        )
                        crud.create_alert(db, alert_in)
                        active_alert_type = alert_type
                        alert_start_time = current_time
                    except Exception as e:
                        logging.error(f"Database error writing alert: {e}")
                    finally:
                        db.close()
            else:
                # Alert cleared
                active_alert_type = None
                alert_start_time = None
                
            # Send result back to client
            await websocket.send_json(result)
            
    except WebSocketDisconnect:
        logging.info("WebSocket disconnected.")
    except Exception as e:
        logging.error(f"WebSocket execution error: {e}")
    finally:
        # Clean up session state
        pass
