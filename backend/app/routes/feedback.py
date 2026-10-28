from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from backend.app.models import FeedbackCreate
from backend.app.database import db_instance

router = APIRouter(prefix="/feedback", tags=["M15 - Feedback & Model Governance"])

@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_feedback(payload: FeedbackCreate):
    comment = (payload.comment or "").strip()
    if len(comment) < 2:
        raise HTTPException(
            status_code=422,
            detail={"code": "SCHEMA_VALIDATION_ERROR", "message": "Feedback comment cannot be empty."}
        )

    now_iso = datetime.utcnow().isoformat() + "Z"
    feedback_id = f"fb_{int(datetime.utcnow().timestamp()*1000)}"

    # Check referenced prediction for traceability
    prediction = next((p for p in db_instance.memory_store["predictions"] if p.get("_id") == payload.prediction_id), None)
    model_version = prediction.get("model_version", "v1.2.0") if prediction else "unknown"

    feedback_doc = {
        "_id": feedback_id,
        "prediction_id": payload.prediction_id,
        "field_id": payload.field_id,
        "farmer_label": payload.farmer_label,
        "comment": comment[:500],
        "model_version": model_version,
        "created_at": now_iso
    }

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.feedback.insert_one(feedback_doc)
    db_instance.memory_store["feedback"].insert(0, feedback_doc)

    return feedback_doc
