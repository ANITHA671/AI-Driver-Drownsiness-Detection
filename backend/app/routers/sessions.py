import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import crud, schemas

router = APIRouter(
    prefix="/api/sessions",
    tags=["Sessions"]
)

@router.post("/", response_model=schemas.Session, status_code=status.HTTP_201_CREATED)
def start_session(session_in: schemas.SessionBase, db: Session = Depends(get_db)):
    """
    Starts a new driver monitoring session. Ends any active session first.
    """
    # Auto-close any open sessions to prevent dangling active states
    active_session = crud.get_active_session(db)
    if active_session:
        end_time = datetime.datetime.utcnow()
        crud.update_session(db, active_session.id, schemas.SessionUpdate(
            end_time=end_time,
            status="COMPLETED"
        ))

    # Create new session with generated UUID
    new_session_id = str(uuid.uuid4())
    session_create = schemas.SessionCreate(
        id=new_session_id,
        driver_name=session_in.driver_name
    )
    return crud.create_session(db, session_create)


@router.get("/active", response_model=schemas.Session)
def get_active_session(db: Session = Depends(get_db)):
    """
    Retrieves the currently active driver session, if any.
    """
    active = crud.get_active_session(db)
    if not active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active monitoring session found."
        )
    return active


@router.post("/{session_id}/end", response_model=schemas.Session)
def end_session(session_id: str, db: Session = Depends(get_db)):
    """
    Ends an active session and computes the final duration.
    """
    session = crud.get_session(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )
    
    if session.status == "COMPLETED":
        return session

    end_time = datetime.datetime.utcnow()
    return crud.update_session(db, session_id, schemas.SessionUpdate(
        end_time=end_time,
        status="COMPLETED"
    ))


@router.get("/", response_model=List[schemas.Session])
def read_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Returns a list of all historical monitoring sessions.
    """
    return crud.list_sessions(db, skip=skip, limit=limit)


@router.get("/{session_id}", response_model=schemas.SessionDetails)
def read_session_details(session_id: str, db: Session = Depends(get_db)):
    """
    Returns detailed logs of a specific session, including alert histories.
    """
    session = crud.get_session(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )
    
    # Enrich details
    alerts = crud.get_alerts_for_session(db, session_id)
    telemetry_count = db.query(crud.models.TelemetryLog).filter(crud.models.TelemetryLog.session_id == session_id).count()
    
    return schemas.SessionDetails(
        id=session.id,
        driver_name=session.driver_name,
        start_time=session.start_time,
        end_time=session.end_time,
        duration=session.duration,
        status=session.status,
        alerts=alerts,
        telemetry_count=telemetry_count
    )


@router.delete("/{session_id}", status_code=status.HTTP_200_OK)
def remove_session(session_id: str, db: Session = Depends(get_db)):
    """
    Permanently deletes a monitoring session and all associated database records.
    """
    success = crud.delete_session(db, session_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )
    return {"message": "Session and all associated logs deleted successfully."}
