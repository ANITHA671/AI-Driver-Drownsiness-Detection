from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import crud, schemas

router = APIRouter(
    prefix="/api/stats",
    tags=["Stats & Analytics"]
)

@router.get("/dashboard", response_model=schemas.DashboardStats)
def read_dashboard_stats(db: Session = Depends(get_db)):
    """
    Returns aggregated stats for the home dashboard (totals, averages, recent alerts, charts).
    """
    return crud.get_dashboard_stats(db)


@router.get("/alerts", response_model=List[schemas.Alert])
def read_alerts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieves historical alert records across all sessions.
    """
    return crud.list_alerts(db, skip=skip, limit=limit)


@router.get("/sessions/{session_id}/telemetry", response_model=List[schemas.Telemetry])
def read_session_telemetry(session_id: str, limit: int = 500, db: Session = Depends(get_db)):
    """
    Retrieves the time-series logs of a session to display on dashboard analytics charts.
    """
    # Check if session exists
    session = crud.get_session(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )
    return crud.get_telemetry_for_session(db, session_id, limit=limit)
