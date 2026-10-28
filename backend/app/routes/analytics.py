from fastapi import APIRouter, HTTPException
from datetime import datetime
from backend.app.database import db_instance

router = APIRouter(prefix="/analytics", tags=["M14 - Analytics & Reporting"])

@router.get("/{field_id}")
async def get_field_analytics(field_id: str):
    field = next((f for f in db_instance.memory_store["fields"] if f.get("_id") == field_id), None)
    if not field:
        # Fallback to first field if available
        field = db_instance.memory_store["fields"][0] if db_instance.memory_store["fields"] else {
            "_id": field_id, "crop": "Wheat", "growth_stage": "flowering", "moisture_threshold": 26.0
        }

    readings = [r for r in db_instance.memory_store["sensor_readings"] if r.get("field_id") == field_id]
    latest = readings[0] if readings else {}

    # Calculate metrics
    window_24h = readings[:24] if readings else []
    avg_moisture = (
        sum(float(r.get("moisture", 0.0)) for r in window_24h) / max(1, len(window_24h))
        if window_24h else float(latest.get("moisture", 22.0))
    )
    avg_temp = (
        sum(float(r.get("temperature", 0.0)) for r in window_24h) / max(1, len(window_24h))
        if window_24h else float(latest.get("temperature", 28.0))
    )
    rainfall_7d = sum(float(r.get("rainfall", 0.0)) for r in readings[:168]) if readings else 0.0

    threshold = float(field.get("moisture_threshold", 24.0))
    water_stress = "deficit" if avg_moisture < threshold else ("optimal" if avg_moisture <= threshold + 12 else "surplus")

    active_alerts = [
        a for a in db_instance.memory_store["alerts"]
        if a.get("field_id") == field_id and a.get("status") == "active"
    ]

    return {
        "field_id": field_id,
        "crop": field.get("crop", "Wheat"),
        "growth_stage": field.get("growth_stage", "flowering"),
        "latest_moisture": float(latest.get("moisture", avg_moisture)),
        "moisture_threshold": threshold,
        "avg_soil_moisture_24h": round(avg_moisture, 1),
        "avg_temperature_24h": round(avg_temp, 1),
        "total_rainfall_7d_mm": round(rainfall_7d, 1),
        "water_stress_status": water_stress,
        "active_alerts_count": len(active_alerts),
        "recent_readings": readings[:10],
        "server_timestamp": datetime.utcnow().isoformat() + "Z"
    }
