import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from backend.app.config import settings
from backend.app.database import connect_to_mongo, close_mongo_connection, db_instance
from backend.app.services.mqtt_service import mqtt_service
from backend.app.routes.readings import validate_and_process_telemetry
from backend.app.routes import (
    auth, farms, fields, sensors, readings, predictions,
    disease, alerts, notifications, analytics, feedback
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("agripulse.main")

def seed_initial_state():
    """Populates baseline agronomic entities conforming to Appendix A & blueprint."""
    if not db_instance.memory_store["farms"]:
        db_instance.memory_store["farms"].append({
            "_id": "FARM-001",
            "user_id": "demo-farmer-01",
            "name": "Karnal Precision Agro Research Farm",
            "location": {"district": "Karnal", "state": "Haryana"},
            "soil_type": "loamy",
            "area": 4.5,
            "created_at": "2026-09-01T06:00:00Z"
        })

    if not db_instance.memory_store["fields"]:
        db_instance.memory_store["fields"].extend([
            {
                "_id": "FIELD-001",
                "farm_id": "FARM-001",
                "name": "North Canal Wheat Parcel",
                "crop": "Wheat",
                "variety": "HD-2967",
                "sowing_date": "2026-09-15",
                "growth_stage": "flowering",
                "area": 1.8,
                "moisture_threshold": 26.0,
                "soil_characteristics": {
                    "phTarget": 6.8,
                    "organicMatterPct": 2.1,
                    "drainage": "well_drained"
                },
                "created_at": "2026-09-15T08:00:00Z"
            },
            {
                "_id": "FIELD-002",
                "farm_id": "FARM-001",
                "name": "Tubewell Mustard Basin",
                "crop": "Mustard",
                "variety": "Pusa Bold",
                "sowing_date": "2026-10-02",
                "growth_stage": "vegetative",
                "area": 1.2,
                "moisture_threshold": 20.0,
                "soil_characteristics": {
                    "phTarget": 7.0,
                    "organicMatterPct": 1.8,
                    "drainage": "moderate"
                },
                "created_at": "2026-10-02T08:00:00Z"
            }
        ])

    if not db_instance.memory_store["sensors"]:
        db_instance.memory_store["sensors"].extend([
            {
                "_id": "sensor_esp32_001",
                "device_id": "ESP32-001",
                "field_id": "FIELD-001",
                "type": "multisensor_node",
                "unit": "pct,celsius,mm",
                "status": "online",
                "calibration": {"moisture_offset": 0.2, "temperature_offset": 0.0, "last_calibrated_at": "2026-10-15T09:00:00Z"},
                "last_seen": "2026-10-28T10:00:00Z",
                "battery_pct": 94,
                "signal_rssi_dbm": -68
            },
            {
                "_id": "sensor_esp32_002",
                "device_id": "ESP32-002",
                "field_id": "FIELD-002",
                "type": "multisensor_node",
                "unit": "pct,celsius,mm",
                "status": "online",
                "calibration": {"moisture_offset": 0.0, "temperature_offset": -0.2, "last_calibrated_at": "2026-10-15T09:00:00Z"},
                "last_seen": "2026-10-28T09:45:00Z",
                "battery_pct": 89,
                "signal_rssi_dbm": -72
            }
        ])

    if not db_instance.memory_store["sensor_readings"]:
        db_instance.memory_store["sensor_readings"].extend([
            {
                "_id": "reading_ESP32-001_1045",
                "sensor_id": "sensor_esp32_001",
                "device_id": "ESP32-001",
                "field_id": "FIELD-001",
                "sequence": 1045,
                "timestamp": "2026-10-28T09:30:00Z",
                "moisture": 17.2,
                "temperature": 33.8,
                "humidity": 64.5,
                "rainfall": 0.0,
                "ph": 6.7,
                "nitrogen": 41,
                "phosphorus": 27,
                "potassium": 35,
                "validation_status": "valid",
                "transport": "mqtt",
                "received_at": "2026-10-28T09:30:05Z"
            }
        ])

    if not db_instance.memory_store["alerts"]:
        db_instance.memory_store["alerts"].append({
            "_id": "ALERT-001",
            "field_id": "FIELD-001",
            "prediction_id": "pred_init_001",
            "type": "irrigation_need",
            "severity": "high",
            "message": "Critical Soil Moisture Deficit on North Canal Wheat Parcel",
            "recommendation": "Initiate light furrow/drip irrigation of ~35-40 mm within 18 hours. Safety interlock check required before pump start.",
            "confidence": 0.91,
            "status": "active",
            "limitations": "Pump control requires manual confirmation.",
            "model_version": "v1.2.0",
            "created_at": "2026-10-28T09:30:10Z",
            "updated_at": "2026-10-28T09:30:10Z",
            "occurrence_count": 1
        })

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Smart Precision Agriculture Backend...")
    seed_initial_state()
    await connect_to_mongo()
    
    # Wire MQTT telemetry handler
    mqtt_service.set_handler(lambda data, transport: validate_and_process_telemetry(data, transport))
    mqtt_service.start()
    
    yield
    
    # Shutdown
    logger.info("Shutting down Smart Precision Agriculture Backend...")
    mqtt_service.stop()
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Farmer-first precision agriculture decision-support platform (Sense → Validate → Store → Understand → Predict → Decide → Alert → Learn)",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# M16 — Security & Health Check
@app.get("/health", tags=["M16 - Security & Health"])
async def health_check():
    return {
        "status": "ok",
        "service": "smart-precision-agriculture-fastapi",
        "version": settings.VERSION,
        "database_connected": db_instance.is_connected,
        "mqtt_connected": mqtt_service.is_connected,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

# Register Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(farms.router, prefix=settings.API_V1_STR)
app.include_router(fields.router, prefix=settings.API_V1_STR)
app.include_router(sensors.router, prefix=settings.API_V1_STR)
app.include_router(readings.router, prefix=settings.API_V1_STR)
app.include_router(predictions.router, prefix=settings.API_V1_STR)
app.include_router(disease.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(feedback.router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
