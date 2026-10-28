from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field as PydanticField
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

    class Config:
        populate_by_name = True

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
    area_hectares: Optional[float] = 2.5
    ownerId: Optional[str] = "demo-farmer-01"

class Farm(BaseModel):
    id: str = PydanticField(..., alias="_id")
    user_id: str
    name: str
    location: Location
    soil_type: SoilType
    area: float
    created_at: str

    class Config:
        populate_by_name = True

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
    name: str
    crop: str
    variety: str
    sowing_date: str
    growth_stage: GrowthStage = "seedling"
    area: float = 1.0
    moisture_threshold: float = 24.0
    soil_characteristics: Optional[SoilCharacteristics] = None

class FieldUpdate(BaseModel):
    growth_stage: Optional[GrowthStage] = None
    moisture_threshold: Optional[float] = None
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

    class Config:
        populate_by_name = True

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

    class Config:
        populate_by_name = True

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

    class Config:
        populate_by_name = True

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

    class Config:
        populate_by_name = True

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

    class Config:
        populate_by_name = True

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

    class Config:
        populate_by_name = True
