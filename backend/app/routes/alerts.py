from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
from backend.app.models import AlertUpdate
from backend.app.database import db_instance

router = APIRouter(prefix="/alerts", tags=["M12 - Alerts & Recommendations"])

@router.get("")
async def get_alerts(
    field_id: Optional[str] = None,
    status: Optional[str] = None
):
    items = db_instance.memory_store["alerts"]
    if field_id and field_id != "all":
        items = [a for a in items if a.get("field_id") == field_id]
    if status and status != "all":
        items = [a for a in items if a.get("status") == status]

    return {
        "items": items,
        "total": len(items),
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.patch("/{alert_id}")
async def update_alert_status(alert_id: str, payload: AlertUpdate):
    alert = next((a for a in db_instance.memory_store["alerts"] if a.get("_id") == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail={"code": "ALERT_NOT_FOUND", "message": f"Alert {alert_id} not found"})

    now_iso = datetime.utcnow().isoformat() + "Z"
    alert["status"] = payload.status
    alert["updated_at"] = now_iso

    if payload.status == "acknowledged":
        alert["acknowledged_at"] = now_iso
    elif payload.status == "resolved":
        alert["resolved_at"] = now_iso

    return alert
