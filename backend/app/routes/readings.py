from fastapi import APIRouter, HTTPException, status, Query
from typing import Optional, List, Dict, Any
from datetime import datetime
from backend.app.models import TelemetryPayload, BatchTelemetryRequest
from backend.app.database import db_instance
from backend.app.services.ml_irrigation import irrigation_model
from backend.app.services.ml_crop_risk import crop_risk_model
from backend.app.services.decision_engine import decision_engine

router = APIRouter(prefix="/readings", tags=["M06 & M07 - Telemetry Ingestion & Storage"])

def validate_and_process_telemetry(payload_dict: Dict[str, Any], transport: str = "mqtt") -> Dict[str, Any]:
    device_id = payload_dict.get("device_id")
    field_id = payload_dict.get("field_id")
    sequence = payload_dict.get("sequence")

    if not device_id or not field_id or sequence is None:
        return {"error": "Missing device_id, field_id, or sequence", "status_code": 422}

    # Deduplication check: (device_id, sequence)
    is_duplicate = any(
        r.get("device_id") == device_id and r.get("sequence") == sequence
        for r in db_instance.memory_store["sensor_readings"]
    )
    if is_duplicate:
        return {"error": f"Duplicate event for device {device_id} sequence {sequence}", "status_code": 409}

    now_iso = datetime.utcnow().isoformat() + "Z"
    
    # Lookup sensor calibration offset
    sensor = next((s for s in db_instance.memory_store["sensors"] if s.get("device_id") == device_id), None)
    moisture_offset = float(sensor.get("calibration", {}).get("moisture_offset", 0.0)) if sensor else 0.0
    temp_offset = float(sensor.get("calibration", {}).get("temperature_offset", 0.0)) if sensor else 0.0

    raw_moisture = float(payload_dict.get("soil_moisture", 0.0))
    raw_temp = float(payload_dict.get("temperature", 0.0))

    calibrated_moisture = round(min(100.0, max(0.0, raw_moisture + moisture_offset)), 1)
    calibrated_temp = round(min(65.0, max(-20.0, raw_temp + temp_offset)), 1)

    reading_doc = {
        "_id": f"reading_{device_id}_{sequence}",
        "sensor_id": f"sensor_{device_id.lower()}",
        "device_id": device_id,
        "field_id": field_id,
        "sequence": sequence,
        "timestamp": payload_dict.get("timestamp", now_iso),
        "moisture": calibrated_moisture,
        "temperature": calibrated_temp,
        "humidity": float(payload_dict.get("humidity", 50.0)),
        "rainfall": float(payload_dict.get("rainfall", 0.0)),
        "ph": payload_dict.get("ph"),
        "nitrogen": payload_dict.get("nitrogen"),
        "phosphorus": payload_dict.get("phosphorus"),
        "potassium": payload_dict.get("potassium"),
        "validation_status": "valid",
        "transport": transport,
        "received_at": now_iso
    }

    # Persist reading
    db_instance.memory_store["sensor_readings"].insert(0, reading_doc)

    # Update sensor device last_seen and online status
    if sensor:
        sensor["last_seen"] = now_iso
        sensor["status"] = "online"

    # Sense -> Validate -> Store -> Understand -> Predict -> Decide -> Alert loop
    field = next((f for f in db_instance.memory_store["fields"] if f.get("_id") == field_id), None)
    if field:
        recent = [r for r in db_instance.memory_store["sensor_readings"] if r.get("field_id") == field_id]
        forced_conf = payload_dict.get("forced_confidence")
        
        # M08 & M09 ML Inference
        irrig_pred = irrigation_model.predict(
            field_crop=field.get("crop", "Wheat"),
            growth_stage=field.get("growth_stage", "flowering"),
            soil_type=field.get("soil_type", "loamy"),
            moisture_threshold=float(field.get("moisture_threshold", 24.0)),
            recent_readings=recent,
            forced_confidence=forced_conf
        )
        crop_risk_pred = crop_risk_model.predict(
            crop=field.get("crop", "Wheat"),
            growth_stage=field.get("growth_stage", "flowering"),
            recent_readings=recent,
            forced_confidence=forced_conf
        )

        # M11 Decision & Safety Engine
        preds_to_store, new_alert = decision_engine.evaluate(
            field=field,
            irrigation_pred=irrig_pred,
            crop_risk_pred=crop_risk_pred,
            existing_alerts=db_instance.memory_store["alerts"],
            forced_confidence=forced_conf
        )

        for p in preds_to_store:
            db_instance.memory_store["predictions"].insert(0, p)
        if new_alert:
            db_instance.memory_store["alerts"].insert(0, new_alert)

    return {"reading": reading_doc, "status_code": 201}

@router.post("", status_code=status.HTTP_201_CREATED)
async def ingest_reading(payload: TelemetryPayload):
    result = validate_and_process_telemetry(payload.model_dump(), transport=payload.transport or "mqtt")
    if "error" in result:
        raise HTTPException(
            status_code=result["status_code"],
            detail={"code": "TELEMETRY_ERROR", "message": result["error"]}
        )
    return result["reading"]

@router.post("/sync-batch", status_code=status.HTTP_200_OK)
async def sync_offline_batch(batch: BatchTelemetryRequest):
    accepted: List[Dict[str, Any]] = []
    duplicates_skipped: List[int] = []
    rejected: List[Dict[str, Any]] = []

    for ev in batch.events:
        res = validate_and_process_telemetry(ev.model_dump(), transport="offline_buffer_sync")
        if res.get("status_code") == 201:
            accepted.append(res["reading"])
        elif res.get("status_code") == 409:
            duplicates_skipped.append(ev.sequence)
        else:
            rejected.append({"sequence": ev.sequence, "reason": res.get("error", "Validation error")})

    return {
        "acceptedCount": len(accepted),
        "duplicatesSkippedCount": len(duplicates_skipped),
        "rejectedCount": len(rejected),
        "accepted": accepted,
        "duplicatesSkipped": duplicates_skipped,
        "rejected": rejected,
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.get("")
async def get_readings(
    field_id: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100)
):
    items = db_instance.memory_store["sensor_readings"]
    if field_id and field_id != "all":
        items = [r for r in items if r.get("field_id") == field_id]

    return {
        "items": items[:limit],
        "total": len(items),
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }
