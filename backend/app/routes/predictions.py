from fastapi import APIRouter
from datetime import datetime
from backend.app.database import db_instance

router = APIRouter(prefix="/predictions", tags=["M08 & M09 - Predictions"])

@router.get("/{field_id}")
async def get_predictions(field_id: str):
    items = db_instance.memory_store["predictions"]
    if field_id != "all":
        items = [p for p in items if p.get("field_id") == field_id]

    return {
        "items": items,
        "total": len(items),
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }
