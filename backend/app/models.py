from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field as PydanticField, ConfigDict
from datetime import datetime

# ============================================================================
# M01 — Identity & Access Management (users collection)
# ============================================================================

UserRole = Literal["farmer", "advisor", "technician", "admin"]
SupportedLanguage = Literal["en", "hi", "es"]

class User(BaseModel):
    id: str = PydanticField(..., alias="_id")
    name: str
    phone: Optional[str] = None
    language: SupportedLanguage = "en"
    role: UserRole = "farmer"
    created_at: str

    model_config = ConfigDict(populate_by_name=True)

class LoginRequest(BaseModel):
    name: Optional[str] = "Rajesh Patel"
    role: Optional[UserRole] = "farmer"
    language: Optional[SupportedLanguage] = "en"
    phone: Optional[str] = None

class LoginResponse(BaseModel):
    token: str
    user: Dict[str, Any]
    serverTimestamp: str

# ============================================================================
# M02 — Farm Management (farms collection)
# ============================================================================

SoilType = Literal["loamy", "clay", "sandy", "silty", "black_cotton", "alluvial"]

class Location(BaseModel):
    district: str
    state: str

class FarmCreate(BaseModel):
    name: str
    district: Optional[str] = None
    state: Optional[str] = None
    location: Optional[Location] = None
    soil_type: Optional[SoilType] = "loamy"
    soilType: Optional[SoilType] = None
    area_hectares: Optional[float] = 2.5
    areaHectares: Optional[float] = None
    area: Optional[float] = None
    ownerId: Optional[str] = "demo-farmer-01"

class Farm(BaseModel):
    id: str = PydanticField(..., alias="_id")
    user_id: str
    name: str
    location: Location
    soil_type: SoilType
    area: float
    created_at: str

    model_config = ConfigDict(populate_by_name=True)

# ============================================================================
# M03 — Field & Crop Management (fields collection)
# ============================================================================

GrowthStage = Literal[
    "germination", "seedling", "vegetative", "tillering",
    "flowering", "grain_filling", "maturity"
]

class SoilCharacteristics(BaseModel):
    phTarget: float = 6.8
    organicMatterPct: float = 2.1
    drainage: Literal["well_drained", "moderate", "poor"] = "well_drained"

class FieldCreate(BaseModel):
    farm_id: Optional[str] = None
    farmId: Optional[str] = None
    name: str
    crop: str
    variety: str
    sowing_date: Optional[str] = None
    sowingDate: Optional[str] = None
    growth_stage: Optional[GrowthStage] = "seedling"
    growthStage: Optional[GrowthStage] = None
    area: Optional[float] = 1.0
    areaHectares: Optional[float] = None
    moisture_threshold: Optional[float] = 24.0
    moistureThreshold: Optional[float] = None
    soil_characteristics: Optional[SoilCharacteristics] = None

class FieldUpdate(BaseModel):
    growth_stage: Optional[GrowthStage] = None
    growthStage: Optional[GrowthStage] = None
    moisture_threshold: Optional[float] = None
    moistureThreshold: Optional[float] = None
    crop: Optional[str] = None
    variety: Optional[str] = None

class AgriField(BaseModel):
    id: str = PydanticField(..., alias="_id")
    farm_id: str
    name: str
    crop: str
    variety: str
    sowing_date: str
    growth_stage: GrowthStage
    area: float
    moisture_threshold: float = 24.0
    soil_characteristics: Optional[SoilCharacteristics] = None
    created_at: str

    model_config = ConfigDict(populate_by_name=True)

# ============================================================================
# M04 — Device Registry & Health (sensors collection)
# ============================================================================

class SensorCalibration(BaseModel):
    moisture_offset: float = 0.0
    temperature_offset: float = 0.0
    last_calibrated_at: str

class SensorRegisterRequest(BaseModel):
    device_id: str
    field_id: str
    type: Optional[str] = "multisensor_node"
    unit: Optional[str] = "pct,celsius,mm"
    firmware_version: Optional[str] = "1.2.0"
    moisture_offset: Optional[float] = 0.0
    temperature_offset: Optional[float] = 0.0

class SensorDevice(BaseModel):
    id: str = PydanticField(..., alias="_id")
    field_id: str
    device_id: str
    type: str = "multisensor_node"
    unit: str = "pct,celsius,mm"
    status: Literal["online", "stale", "offline", "maintenance"] = "online"
    calibration: SensorCalibration
    last_seen: str
    battery_pct: Optional[int] = 95
    signal_rssi_dbm: Optional[int] = -68

    model_config = ConfigDict(populate_by_name=True)

# ============================================================================
# M06 / M07 — Telemetry Ingestion & Storage (sensor_readings collection)
# ============================================================================

class TelemetryPayload(BaseModel):
    device_id: str
    field_id: str
    timestamp: str
    sequence: int
    soil_moisture: float
    temperature: float
    humidity: float
    rainfall: float
    ph: Optional[float] = None
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    firmware_version: Optional[str] = "1.2.0"
    transport: Optional[Literal["mqtt", "http_fallback", "offline_buffer_sync"]] = "mqtt"
    forced_confidence: Optional[float] = None

class BatchTelemetryRequest(BaseModel):
    events: List[TelemetryPayload]

class SensorReading(BaseModel):
    id: str = PydanticField(..., alias="_id")
    sensor_id: str
    field_id: str
    sequence: int
    timestamp: str
    moisture: float
    temperature: float
    humidity: float
    rainfall: float
    ph: Optional[float] = None
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    validation_status: Literal["valid", "stale", "future_dated", "out_of_range"] = "valid"
    transport: Literal["mqtt", "http_fallback", "offline_buffer_sync"] = "mqtt"
    received_at: str

    model_config = ConfigDict(populate_by_name=True)

# ============================================================================
# M08 / M09 — Predictions (predictions collection)
# ============================================================================

AlertSeverity = Literal["low", "medium", "high"]
PredictionType = Literal["irrigation_need", "crop_environment_risk", "leaf_disease"]
PredictionStatus = Literal["ready", "needs_review", "insufficient_data"]

class Prediction(BaseModel):
    id: str = PydanticField(..., alias="_id")
    field_id: str
    timestamp: str
    type: PredictionType
    risk_score: float
    confidence: float
    severity: AlertSeverity
    status: PredictionStatus
    model_version: str
    explanation: str
    recommendation: str

    model_config = ConfigDict(populate_by_name=True)

# ============================================================================
# M10 — Leaf Disease Vision
# ============================================================================

class LeafDiseaseRequest(BaseModel):
    field_id: str
    sample_preset: Optional[str] = "wheat_stripe_rust"
    image_base64: Optional[str] = None
    mime_type: Optional[str] = "image/jpeg"
    notes: Optional[str] = None

class LeafDiseaseResult(BaseModel):
    id: str
    field_id: str
    crop: str
    image_quality: Dict[str, Any]
    disease_class: str
    confidence: float
    model_version: str
    status: PredictionStatus
    severity: AlertSeverity
    explanation: str
    limitations: str
    recommended_next_step: str
    created_at: str

# ============================================================================
# M11 / M12 — Alerts & Recommendations (alerts collection)
# ============================================================================

AlertStatus = Literal["active", "acknowledged", "resolved"]

class AlertUpdate(BaseModel):
    status: AlertStatus

class Alert(BaseModel):
    id: str = PydanticField(..., alias="_id")
    field_id: str
    prediction_id: str
    type: PredictionType
    severity: AlertSeverity
    message: str
    recommendation: str
    confidence: float
    status: AlertStatus
    limitations: Optional[str] = None
    model_version: str = "v1.2.0"
    created_at: str
    updated_at: str
    acknowledged_at: Optional[str] = None
    resolved_at: Optional[str] = None
    occurrence_count: int = 1

    model_config = ConfigDict(populate_by_name=True)

# ============================================================================
# M13 — Notification Delivery
# ============================================================================

class NotificationDispatch(BaseModel):
    alert_id: str
    channel: Literal["in_app", "sms", "push", "voice"]
    recipient_phone: Optional[str] = None
    message: str
    status: Literal["queued", "delivered", "failed"]
    dispatched_at: str

# ============================================================================
# M14 — Analytics
# ============================================================================

class FieldAnalytics(BaseModel):
    field_id: str
    crop: str
    growth_stage: str
    latest_moisture: float
    moisture_threshold: float
    avg_soil_moisture_24h: float
    avg_temperature_24h: float
    total_rainfall_7d_mm: float
    water_stress_status: str
    active_alerts_count: int
    recent_readings: List[Dict[str, Any]]
    server_timestamp: str

# ============================================================================
# M15 — Feedback & Model Governance (feedback collection)
# ============================================================================

FarmerFeedbackLabel = Literal[
    "accurate_helpful", "false_alarm", "too_late", "needs_calibration"
]

class FeedbackCreate(BaseModel):
    prediction_id: str
    field_id: str
    farmer_label: FarmerFeedbackLabel
    comment: str
    ownerId: Optional[str] = "demo-farmer-01"

class Feedback(BaseModel):
    id: str = PydanticField(..., alias="_id")
    prediction_id: str
    farmer_label: FarmerFeedbackLabel
    comment: str
    created_at: str

    model_config = ConfigDict(populate_by_name=True)

# ============================================================================
# Collaborative Tasks & Safety Workflow
# ============================================================================

TaskCategory = Literal["irrigation", "scouting", "sensor_maintenance", "soil_nutrition", "disease_management"]
TaskPriority = Literal["low", "medium", "high"]
TaskStatus = Literal["todo", "in_progress", "completed"]

class TaskComment(BaseModel):
    id: str
    author_id: str = PydanticField(..., alias="authorId")
    author_name: str = PydanticField(..., alias="authorName")
    author_role: Optional[UserRole] = PydanticField("farmer", alias="authorRole")
    content: str
    created_at: str = PydanticField(..., alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)

class TaskCreate(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    farm_id: Optional[str] = None
    farmId: Optional[str] = None
    field_id: Optional[str] = None
    fieldId: Optional[str] = None
    category: TaskCategory = "irrigation"
    priority: TaskPriority = "high"
    status: Optional[TaskStatus] = "todo"
    assignee_name: Optional[str] = None
    assigneeName: Optional[str] = "Rajesh Patel (Lead Farmer)"
    assignee_id: Optional[str] = None
    assigneeId: Optional[str] = "demo-farmer-01"
    due_date: Optional[str] = None
    dueDate: Optional[str] = None
    owner_id: Optional[str] = None
    ownerId: Optional[str] = "demo-farmer-01"
    linked_alert_id: Optional[str] = None
    linkedAlertId: Optional[str] = None
    safety_interlock_required: Optional[bool] = None
    safetyInterlockRequired: Optional[bool] = True

class TaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    safety_confirmed_by: Optional[str] = None
    safetyConfirmedBy: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None

class Task(BaseModel):
    id: str = PydanticField(..., alias="_id")
    owner_id: str = PydanticField(..., alias="ownerId")
    farm_id: str = PydanticField(..., alias="farmId")
    field_id: str = PydanticField(..., alias="fieldId")
    title: str
    description: str
    category: TaskCategory
    priority: TaskPriority
    status: TaskStatus
    assignee_name: str = PydanticField(..., alias="assigneeName")
    assignee_id: str = PydanticField(..., alias="assigneeId")
    due_date: str = PydanticField(..., alias="dueDate")
    linked_alert_id: Optional[str] = PydanticField(None, alias="linkedAlertId")
    safety_interlock_required: bool = PydanticField(False, alias="safetyInterlockRequired")
    safety_confirmed_by: Optional[str] = PydanticField(None, alias="safetyConfirmedBy")
    comments: List[Dict[str, Any]] = []
    created_at: str = PydanticField(..., alias="createdAt")
    updated_at: str = PydanticField(..., alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
