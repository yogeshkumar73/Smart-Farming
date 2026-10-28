from fastapi import APIRouter
from backend.app.models import LeafDiseaseRequest
from backend.app.database import db_instance
from backend.app.services.ml_vision import leaf_vision_service

router = APIRouter(prefix="/disease", tags=["M10 - Leaf Disease Vision"])

@router.post("/analyze")
async def analyze_leaf(payload: LeafDiseaseRequest):
    field = next((f for f in db_instance.memory_store["fields"] if f.get("_id") == payload.field_id), None)
    crop = field.get("crop", "Wheat") if field else "Wheat"

    result = leaf_vision_service.analyze(
        field_id=payload.field_id,
        crop=crop,
        sample_preset=payload.sample_preset,
        image_base64=payload.image_base64,
        notes=payload.notes
    )

    return result
