
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sqlite3

app = FastAPI(title="SafeHer API")

# Allow frontend connection (local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create SQLite database
def connect_db():
    return sqlite3.connect("safeher.db")

# Create reports table
with connect_db() as db:
    db.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL
        )
    """)

# Report data validation
class Report(BaseModel):
    category: str
    description: str = Field(min_length=5, max_length=1000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

# Home page
@app.get("/")
def home():
    return {
        "message": "Welcome to SafeHer Backend!",
        "status": "running"
    }

# Save a safety report
@app.post("/reports")
def save_report(report: Report):
    with connect_db() as db:
        cursor = db.execute(
            """INSERT INTO reports
            (category, description, latitude, longitude)
            VALUES (?, ?, ?, ?)""",
            (
                report.category,
                report.description,
                report.latitude,
                report.longitude
            )
        )

        report_id = cursor.lastrowid

    return {
        "message": "Report saved successfully",
        "id": report_id
    }

# Get all safety reports
@app.get("/reports")
def get_reports():
    with connect_db() as db:
        db.row_factory = sqlite3.Row
        rows = db.execute(
            "SELECT * FROM reports ORDER BY id DESC"
        ).fetchall()

    return [dict(row) for row in rows]
