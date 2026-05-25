import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Locate database in the backend directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DB_DIR, exist_ok=True)

# Replace backslashes with forward slashes to support Windows paths with spaces cleanly
db_path = os.path.join(DB_DIR, "drowsiness_system.db").replace("\\", "/")
DATABASE_URL = f"sqlite:///{db_path}"

# Create engine with connect_args for thread-safety in SQLite
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
