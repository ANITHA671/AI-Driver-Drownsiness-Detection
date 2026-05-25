from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# --- Telemetry Schemas ---
class TelemetryBase(BaseModel):
    ear: float
    mar: float
    head_pitch: float
    head_yaw: float
    drowsiness_score: float
    is_drowsy: bool

class TelemetryCreate(TelemetryBase):
    session_id: str

class Telemetry(TelemetryBase):
    id: int
    session_id: str
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Alert Schemas ---
class AlertBase(BaseModel):
    alert_type: str
    severity: str
    ear_value: Optional[float] = None
    mar_value: Optional[float] = None
    duration_seconds: float

class AlertCreate(AlertBase):
    session_id: str
    timestamp: Optional[datetime] = None

class Alert(AlertBase):
    id: int
    session_id: str
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Session Schemas ---
class SessionBase(BaseModel):
    driver_name: str = "Default Driver"

class SessionCreate(SessionBase):
    id: str

class SessionUpdate(BaseModel):
    end_time: Optional[datetime] = None
    duration: Optional[float] = None
    status: Optional[str] = None

class Session(SessionBase):
    id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: float
    status: str

    class Config:
        from_attributes = True

# --- Dashboard Analytics & Stats ---
class StatusCounts(BaseModel):
    total_alerts: int
    drowsy_ear_alerts: int
    drowsy_yawn_alerts: int
    distracted_look_away_alerts: int
    distracted_head_down_alerts: int

class SessionDetails(Session):
    alerts: List[Alert] = []
    telemetry_count: int = 0

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_sessions: int
    total_duration_seconds: float
    total_alerts: int
    average_session_duration: float
    recent_alerts: List[Alert]
    status_distribution: StatusCounts
    session_trend: List[dict]  # Date and alert count or duration
