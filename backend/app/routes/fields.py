from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from backend.app.models import FieldUpdate
from backend.app.database import db_instance

router = APIRouter(prefix="/fields", tags=["M03 - Field & Crop Management"])

@router.get("/{field_id}")
async def get_field(field_id: str):
    field = None
    if db_instance.is_connected and db_instance.db is not None:
        field = await db_instance.db.fields.find_one({"_id": field_id})
    else:
        field = next((f for f in db_instance.memory_store["fields"] if f.get("_id") == field_id), None)

    if not field:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": f"Field {field_id} not found"})
    return field

@router.patch("/{field_id}")
async def update_field(field_id: str, payload: FieldUpdate):
    field = None
    if db_instance.is_connected and db_instance.db is not None:
        field = await db_instance.db.fields.find_one({"_id": field_id})
    else:
        field = next((f for f in db_instance.memory_store["fields"] if f.get("_id") == field_id), None)

    if not field:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": f"Field {field_id} not found"})

    updates = {}
    growth_stage = payload.growthStage or payload.growth_stage
    if growth_stage:
        updates["growth_stage"] = growth_stage
    moisture_threshold = payload.moistureThreshold if payload.moistureThreshold is not None else payload.moisture_threshold
    if moisture_threshold is not None:
        updates["moisture_threshold"] = moisture_threshold
    if payload.crop:
        updates["crop"] = payload.crop
    if payload.variety:
        updates["variety"] = payload.variety

    field.update(updates)
    field["updated_at"] = datetime.utcnow().isoformat() + "Z"

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.fields.update_one({"_id": field_id}, {"$set": updates})

    return field
