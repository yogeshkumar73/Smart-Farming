from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from datetime import datetime
from backend.app.models import Farm, FarmCreate, AgriField, FieldCreate
from backend.app.database import db_instance

router = APIRouter(tags=["M02 & M03 - Farm & Field Management"])

@router.get("/farms")
async def get_farms():
    if db_instance.is_connected and db_instance.db is not None:
        cursor = db_instance.db.farms.find({})
        items = await cursor.to_list(length=100)
    else:
        items = db_instance.memory_store["farms"]
    return {
        "items": items,
        "total": len(items),
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.post("/farms", status_code=status.HTTP_201_CREATED)
async def create_farm(payload: FarmCreate):
    name = (payload.name or "").strip()
    if len(name) < 2 or len(name) > 100:
        raise HTTPException(
            status_code=422,
            detail={"code": "SCHEMA_VALIDATION_ERROR", "message": "Farm name must be 2 to 100 characters."}
        )

    district = payload.district or (payload.location.district if payload.location else "Karnal District")
    state_loc = payload.state or (payload.location.state if payload.location else "Uttar Pradesh")
    soil_type = payload.soilType or payload.soil_type or "loamy"
    area = float(payload.areaHectares if payload.areaHectares is not None else (payload.area_hectares if payload.area_hectares is not None else (payload.area or 2.5)))

    now_iso = datetime.utcnow().isoformat() + "Z"
    farm_id = f"FARM-00{len(db_instance.memory_store['farms']) + 1}"

    farm_doc = {
        "_id": farm_id,
        "user_id": payload.ownerId or "demo-farmer-01",
        "name": name,
        "location": {"district": district, "state": state_loc},
        "soil_type": soil_type,
        "area": area,
        "created_at": now_iso
    }

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.farms.insert_one(farm_doc)
    db_instance.memory_store["farms"].insert(0, farm_doc)

    return farm_doc

@router.get("/farms/{farm_id}/fields")
async def get_fields_for_farm(farm_id: str):
    if db_instance.is_connected and db_instance.db is not None:
        query = {} if farm_id == "all" else {"farm_id": farm_id}
        items = await db_instance.db.fields.find(query).to_list(length=100)
    else:
        items = (
            db_instance.memory_store["fields"]
            if farm_id == "all"
            else [f for f in db_instance.memory_store["fields"] if f.get("farm_id") == farm_id]
        )

    return {
        "items": items,
        "total": len(items),
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.post("/farms/{farm_id}/fields", status_code=status.HTTP_201_CREATED)
async def create_field_for_farm(farm_id: str, payload: FieldCreate):
    now_iso = datetime.utcnow().isoformat() + "Z"
    field_id = f"FIELD-00{len(db_instance.memory_store['fields']) + 1}"

    sowing_date = payload.sowingDate or payload.sowing_date or datetime.utcnow().strftime("%Y-%m-%d")
    growth_stage = payload.growthStage or payload.growth_stage or "seedling"
    area = float(payload.areaHectares if payload.areaHectares is not None else (payload.area if payload.area is not None else 1.0))
    moisture_threshold = float(payload.moistureThreshold if payload.moistureThreshold is not None else (payload.moisture_threshold if payload.moisture_threshold is not None else 24.0))

    field_doc = {
        "_id": field_id,
        "farm_id": farm_id,
        "name": payload.name,
        "crop": payload.crop,
        "variety": payload.variety,
        "sowing_date": sowing_date,
        "growth_stage": growth_stage,
        "area": area,
        "moisture_threshold": moisture_threshold,
        "soil_characteristics": payload.soil_characteristics.model_dump() if payload.soil_characteristics else {
            "phTarget": 6.8,
            "organicMatterPct": 2.1,
            "drainage": "well_drained"
        },
        "created_at": now_iso
    }

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.fields.insert_one(field_doc)
    db_instance.memory_store["fields"].insert(0, field_doc)

    return field_doc
