import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class DriverSession(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    driver_name = Column(String, default="Default Driver")
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration = Column(Float, default=0.0)  # in seconds
    status = Column(String, default="ACTIVE")  # ACTIVE, COMPLETED

    alerts = relationship("AlertHistory", back_populates="session", cascade="all, delete-orphan")
    telemetry = relationship("TelemetryLog", back_populates="session", cascade="all, delete-orphan")


class AlertHistory(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    alert_type = Column(String, nullable=False)  # DROWSY_EAR, DROWSY_YAWN, DISTRACTED_LOOK_AWAY, DISTRACTED_HEAD_DOWN
    severity = Column(String, default="WARNING")  # WARNING, DANGER
    ear_value = Column(Float, nullable=True)
    mar_value = Column(Float, nullable=True)
    duration_seconds = Column(Float, default=0.0)

    session = relationship("DriverSession", back_populates="alerts")


class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    ear = Column(Float, nullable=False)
    mar = Column(Float, nullable=False)
    head_pitch = Column(Float, nullable=False)
    head_yaw = Column(Float, nullable=False)
    drowsiness_score = Column(Float, default=0.0)
    is_drowsy = Column(Boolean, default=False)

    session = relationship("DriverSession", back_populates="telemetry")
