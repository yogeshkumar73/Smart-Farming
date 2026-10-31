from fastapi import APIRouter, HTTPException, status
from typing import Optional, List, Dict, Any
from datetime import datetime
from backend.app.models import TaskCreate, TaskUpdate, Task, TaskComment
from backend.app.database import db_instance

router = APIRouter(prefix="/tasks", tags=["Collaborative Field Tasks & Safety Workflow"])

@router.get("")
async def get_tasks(
    field_id: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None
):
    items = db_instance.memory_store.get("tasks", [])
    if field_id and field_id != "all":
        items = [t for t in items if t.get("fieldId") == field_id or t.get("field_id") == field_id]
    if status and status != "all":
        items = [t for t in items if t.get("status") == status]
    if category and category != "all":
        items = [t for t in items if t.get("category") == category]

    return {
        "items": items,
        "total": len(items),
        "serverTimestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate):
    title = (payload.title or "").strip()
    if len(title) < 3 or len(title) > 160:
        raise HTTPException(
            status_code=422,
            detail={"code": "SCHEMA_VALIDATION_ERROR", "message": "Task title must be 3 to 160 characters."}
        )

    now_iso = datetime.utcnow().isoformat() + "Z"
    task_id = payload.id or f"TASK-{int(datetime.utcnow().timestamp()*1000) % 100000:05d}"

    farm_id = payload.farmId or payload.farm_id or "FARM-001"
    field_id = payload.fieldId or payload.field_id or "FIELD-001"
    assignee_name = payload.assigneeName or payload.assignee_name or "Rajesh Patel (Lead Farmer)"
    assignee_id = payload.assigneeId or payload.assignee_id or "demo-farmer-01"
    owner_id = payload.ownerId or payload.owner_id or "demo-farmer-01"
    due_date = payload.dueDate or payload.due_date or datetime.utcnow().strftime("%Y-%m-%d")
    safety_req = payload.safetyInterlockRequired if payload.safetyInterlockRequired is not None else (
        payload.safety_interlock_required if payload.safety_interlock_required is not None else True
    )

    task_doc = {
        "_id": task_id,
        "id": task_id,
        "ownerId": owner_id,
        "farmId": farm_id,
        "fieldId": field_id,
        "title": title,
        "description": (payload.description or "").strip()[:1000],
        "category": payload.category,
        "priority": payload.priority,
        "status": payload.status or "todo",
        "assigneeName": assignee_name,
        "assigneeId": assignee_id,
        "dueDate": due_date,
        "linkedAlertId": payload.linkedAlertId or payload.linked_alert_id,
        "safetyInterlockRequired": safety_req,
        "safetyConfirmedBy": None,
        "comments": [],
        "createdAt": now_iso,
        "updatedAt": now_iso,
        "syncSource": "backend_api"
    }

    if "tasks" not in db_instance.memory_store:
        db_instance.memory_store["tasks"] = []

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.tasks.insert_one(task_doc)

    db_instance.memory_store["tasks"].insert(0, task_doc)
    return task_doc

@router.patch("/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate):
    tasks_list = db_instance.memory_store.get("tasks", [])
    task = next((t for t in tasks_list if t.get("_id") == task_id or t.get("id") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": f"Task {task_id} not found"})

    now_iso = datetime.utcnow().isoformat() + "Z"
    if payload.status:
        task["status"] = payload.status
    safety_confirmed = payload.safetyConfirmedBy or payload.safety_confirmed_by
    if safety_confirmed:
        task["safetyConfirmedBy"] = safety_confirmed
    if payload.title:
        task["title"] = payload.title.strip()[:160]
    if payload.description:
        task["description"] = payload.description.strip()[:1000]
    if payload.priority:
        task["priority"] = payload.priority

    task["updatedAt"] = now_iso

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.tasks.update_one({"_id": task_id}, {"$set": task})

    return task

@router.delete("/{task_id}", status_code=status.HTTP_200_OK)
async def delete_task(task_id: str):
    tasks_list = db_instance.memory_store.get("tasks", [])
    existing = next((t for t in tasks_list if t.get("_id") == task_id or t.get("id") == task_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": f"Task {task_id} not found"})

    db_instance.memory_store["tasks"] = [
        t for t in tasks_list if t.get("_id") != task_id and t.get("id") != task_id
    ]

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.tasks.delete_one({"_id": task_id})

    return {"deleted": True, "id": task_id}

@router.post("/{task_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_task_comment(task_id: str, payload: Dict[str, Any]):
    tasks_list = db_instance.memory_store.get("tasks", [])
    task = next((t for t in tasks_list if t.get("_id") == task_id or t.get("id") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": f"Task {task_id} not found"})

    content = (payload.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail={"code": "SCHEMA_VALIDATION_ERROR", "message": "Comment content cannot be empty."})

    now_iso = datetime.utcnow().isoformat() + "Z"
    comment = {
        "id": f"comm_{int(datetime.utcnow().timestamp()*1000)}",
        "authorId": payload.get("authorId") or payload.get("author_id") or "demo-farmer-01",
        "authorName": payload.get("authorName") or payload.get("author_name") or "Rajesh Patel (Lead Farmer)",
        "authorRole": payload.get("authorRole") or payload.get("author_role") or "farmer",
        "content": content[:500],
        "createdAt": now_iso
    }

    if "comments" not in task:
        task["comments"] = []
    task["comments"].append(comment)
    task["updatedAt"] = now_iso

    if db_instance.is_connected and db_instance.db is not None:
        await db_instance.db.tasks.update_one({"_id": task_id}, {"$set": {"comments": task["comments"], "updatedAt": now_iso}})

    return comment
