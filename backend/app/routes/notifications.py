from fastapi import APIRouter
from datetime import datetime
from typing import List, Dict, Any
from backend.app.models import NotificationDispatch

router = APIRouter(prefix="/notifications", tags=["M13 - Notification Delivery"])

# In-memory notification log
notifications_log: List[Dict[str, Any]] = [
    {
        "id": "notif_001",
        "alert_id": "ALERT-001",
        "channel": "sms",
        "recipient_phone": "+91 98765 43210",
        "message": "AgriPulse Alert: Critical moisture deficit on North Canal Wheat Parcel (17.2%). Irrigate ~40mm.",
        "status": "delivered",
        "dispatched_at": "2026-10-28T06:00:00Z"
    },
    {
        "id": "notif_002",
        "alert_id": "ALERT-001",
        "channel": "in_app",
        "message": "In-app broadcast delivered to farmer dashboard.",
        "status": "delivered",
        "dispatched_at": "2026-10-28T06:00:00Z"
    }
]

@router.get("")
async def get_notifications():
    return {
        "items": notifications_log,
        "total": len(notifications_log),
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.post("/send")
async def send_notification(payload: NotificationDispatch):
    entry = payload.model_dump()
    entry["id"] = f"notif_{int(datetime.utcnow().timestamp()*1000)}"
    entry["status"] = "delivered"
    notifications_log.insert(0, entry)
    return entry
