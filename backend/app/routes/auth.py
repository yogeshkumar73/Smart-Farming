from fastapi import APIRouter, status
from datetime import datetime
from backend.app.models import LoginRequest, LoginResponse
from backend.app.database import db_instance

router = APIRouter(prefix="/auth", tags=["M01 - Authentication"])

@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(req: LoginRequest):
    user_id = "demo-farmer-01"
    now_iso = datetime.utcnow().isoformat() + "Z"

    user_data = {
        "_id": user_id,
        "name": req.name or "Rajesh Patel",
        "role": req.role or "farmer",
        "language": req.language or "en",
        "phone": req.phone or "+91 98765 43210",
        "created_at": now_iso
    }

    # Persist or update in MongoDB users collection
    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.users.update_one(
            {"_id": user_id},
            {"$set": user_data},
            upsert=True
        )
    else:
        # Memory fallback
        db_instance.memory_store["users"] = [
            u for u in db_instance.memory_store["users"] if u.get("_id") != user_id
        ]
        db_instance.memory_store["users"].append(user_data)

    return LoginResponse(
        token=f"jwt_agri_{int(datetime.utcnow().timestamp())}",
        user=user_data,
        serverTimestamp=now_iso
    )
