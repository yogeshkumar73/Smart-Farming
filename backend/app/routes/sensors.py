from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from backend.app.models import SensorRegisterRequest
from backend.app.database import db_instance

router = APIRouter(prefix="/sensors", tags=["M04 - Device Registry & Health"])

@router.get("")
async def get_sensors():
    if db_instance.is_connected and db_instance.db is not None:
        items = await db_instance.db.sensors.find({}).to_list(length=100)
    else:
        items = db_instance.memory_store["sensors"]

    return {
        "items": items,
        "total": len(items),
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_sensor(payload: SensorRegisterRequest):
    now_iso = datetime.utcnow().isoformat() + "Z"
    sensor_id = f"sensor_{payload.device_id.lower()}"

    sensor_doc = {
        "_id": sensor_id,
        "device_id": payload.device_id,
        "field_id": payload.field_id,
        "type": payload.type or "multisensor_node",
        "unit": payload.unit or "pct,celsius,mm",
        "status": "online",
        "firmware_version": payload.firmware_version or "1.2.0",
        "calibration": {
            "moisture_offset": float(payload.moisture_offset or 0.0),
            "temperature_offset": float(payload.temperature_offset or 0.0),
            "last_calibrated_at": now_iso
        },
        "last_seen": now_iso,
        "battery_pct": 98,
        "signal_rssi_dbm": -65
    }

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.sensors.update_one(
            {"device_id": payload.device_id},
            {"$set": sensor_doc},
            upsert=True
        )

    # Memory store upsert
    existing_idx = next(
        (i for i, s in enumerate(db_instance.memory_store["sensors"]) if s.get("device_id") == payload.device_id),
        None
    )
    if existing_idx is not None:
        db_instance.memory_store["sensors"][existing_idx] = sensor_doc
    else:
        db_instance.memory_store["sensors"].append(sensor_doc)

    return sensor_doc
