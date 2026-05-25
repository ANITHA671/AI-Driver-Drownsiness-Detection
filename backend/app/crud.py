import datetime
from typing import Optional, List
from sqlalchemy import func
from sqlalchemy.orm import Session
from . import models, schemas

# --- Session CRUD ---
def create_session(db: Session, session: schemas.SessionCreate) -> models.DriverSession:
    db_session = models.DriverSession(
        id=session.id,
        driver_name=session.driver_name,
        start_time=datetime.datetime.utcnow(),
        status="ACTIVE"
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def get_session(db: Session, session_id: str) -> Optional[models.DriverSession]:
    return db.query(models.DriverSession).filter(models.DriverSession.id == session_id).first()

def get_active_session(db: Session) -> Optional[models.DriverSession]:
    return db.query(models.DriverSession).filter(models.DriverSession.status == "ACTIVE").first()

def update_session(db: Session, session_id: str, updates: schemas.SessionUpdate) -> Optional[models.DriverSession]:
    db_session = get_session(db, session_id)
    if not db_session:
        return None
    
    if updates.end_time:
        db_session.end_time = updates.end_time
        # Recalculate duration if end_time is provided
        delta = updates.end_time - db_session.start_time
        db_session.duration = delta.total_seconds()
    if updates.status:
        db_session.status = updates.status
    if updates.duration is not None:
        db_session.duration = updates.duration
        
    db.commit()
    db.refresh(db_session)
    return db_session

def list_sessions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.DriverSession).order_by(models.DriverSession.start_time.desc()).offset(skip).limit(limit).all()

def delete_session(db: Session, session_id: str) -> bool:
    db_session = get_session(db, session_id)
    if not db_session:
        return False
    db.delete(db_session)
    db.commit()
    return True

# --- Telemetry CRUD ---
def create_telemetry(db: Session, telemetry: schemas.TelemetryCreate) -> models.TelemetryLog:
    db_telemetry = models.TelemetryLog(
        session_id=telemetry.session_id,
        timestamp=datetime.datetime.utcnow(),
        ear=telemetry.ear,
        mar=telemetry.mar,
        head_pitch=telemetry.head_pitch,
        head_yaw=telemetry.head_yaw,
        drowsiness_score=telemetry.drowsiness_score,
        is_drowsy=telemetry.is_drowsy
    )
    db.add(db_telemetry)
    db.commit()
    db.refresh(db_telemetry)
    return db_telemetry

def get_telemetry_for_session(db: Session, session_id: str, limit: int = 500):
    return db.query(models.TelemetryLog)\
             .filter(models.TelemetryLog.session_id == session_id)\
             .order_by(models.TelemetryLog.timestamp.asc())\
             .limit(limit).all()

# --- Alert CRUD ---
def create_alert(db: Session, alert: schemas.AlertCreate) -> models.AlertHistory:
    db_alert = models.AlertHistory(
        session_id=alert.session_id,
        timestamp=alert.timestamp or datetime.datetime.utcnow(),
        alert_type=alert.alert_type,
        severity=alert.severity,
        ear_value=alert.ear_value,
        mar_value=alert.mar_value,
        duration_seconds=alert.duration_seconds
    )
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert

def get_alerts_for_session(db: Session, session_id: str):
    return db.query(models.AlertHistory)\
             .filter(models.AlertHistory.session_id == session_id)\
             .order_by(models.AlertHistory.timestamp.desc()).all()

def list_alerts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.AlertHistory).order_by(models.AlertHistory.timestamp.desc()).offset(skip).limit(limit).all()

# --- Dashboard Stats Analytics ---
def get_dashboard_stats(db: Session) -> schemas.DashboardStats:
    total_sessions = db.query(func.count(models.DriverSession.id)).scalar() or 0
    total_duration_seconds = db.query(func.sum(models.DriverSession.duration)).scalar() or 0.0
    total_alerts = db.query(func.count(models.AlertHistory.id)).scalar() or 0
    
    avg_duration = 0.0
    if total_sessions > 0:
        avg_duration = total_duration_seconds / total_sessions
        
    recent_alerts_db = db.query(models.AlertHistory)\
                         .order_by(models.AlertHistory.timestamp.desc())\
                         .limit(10).all()
                         
    # Alert counts by type
    drowsy_ear = db.query(func.count(models.AlertHistory.id)).filter(models.AlertHistory.alert_type == "DROWSY_EAR").scalar() or 0
    drowsy_yawn = db.query(func.count(models.AlertHistory.id)).filter(models.AlertHistory.alert_type == "DROWSY_YAWN").scalar() or 0
    look_away = db.query(func.count(models.AlertHistory.id)).filter(models.AlertHistory.alert_type == "DISTRACTED_LOOK_AWAY").scalar() or 0
    head_down = db.query(func.count(models.AlertHistory.id)).filter(models.AlertHistory.alert_type == "DISTRACTED_HEAD_DOWN").scalar() or 0
    
    status_counts = schemas.StatusCounts(
        total_alerts=total_alerts,
        drowsy_ear_alerts=drowsy_ear,
        drowsy_yawn_alerts=drowsy_yawn,
        distracted_look_away_alerts=look_away,
        distracted_head_down_alerts=head_down
    )
    
    # 7-day session aggregation for trends
    # In SQLite, we can group by date string
    today = datetime.datetime.utcnow().date()
    seven_days_ago = today - datetime.timedelta(days=7)
    
    # Select date and count of sessions and alerts
    trend_results = db.query(
        func.strftime("%Y-%m-%d", models.DriverSession.start_time).label("date"),
        func.count(models.DriverSession.id).label("session_count"),
        func.sum(models.DriverSession.duration).label("duration_sum")
    ).filter(models.DriverSession.start_time >= seven_days_ago)\
     .group_by("date")\
     .order_by("date").all()
     
    session_trend = []
    # Fill in last 7 days to ensure clean data for charts
    trend_dict = {r.date: {"session_count": r.session_count, "duration_sum": r.duration_sum or 0.0} for r in trend_results}
    
    for i in range(7):
        day = seven_days_ago + datetime.timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        stats = trend_dict.get(day_str, {"session_count": 0, "duration_sum": 0.0})
        
        # Get count of alerts on that day
        alert_count = db.query(func.count(models.AlertHistory.id))\
                        .filter(func.strftime("%Y-%m-%d", models.AlertHistory.timestamp) == day_str).scalar() or 0
                        
        session_trend.append({
            "date": day_str,
            "sessions": stats["session_count"],
            "duration": round(stats["duration_sum"] / 60, 2),  # duration in minutes
            "alerts": alert_count
        })
        
    return schemas.DashboardStats(
        total_sessions=total_sessions,
        total_duration_seconds=total_duration_seconds,
        total_alerts=total_alerts,
        average_session_duration=avg_duration,
        recent_alerts=recent_alerts_db,
        status_distribution=status_counts,
        session_trend=session_trend
    )
