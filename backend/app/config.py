import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "Smart Precision Agriculture API"
    VERSION: str = "1.2.0"
    API_V1_STR: str = "/api/v1"
    
    # MongoDB Config (Appendix A)
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "precision_agriculture")
    
    # MQTT Config (M06)
    MQTT_BROKER_HOST: str = os.getenv("MQTT_BROKER_HOST", "localhost")
    MQTT_BROKER_PORT: int = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    MQTT_TOPIC_SUBSCRIPTION: str = "farm/+/field/+/sensor/+"
    
    # Agronomic Decision & Safety Engine Thresholds (M11)
    MIN_CONFIDENCE_THRESHOLD: float = 0.70
    STALE_READING_THRESHOLD_MINUTES: int = 60
    FUTURE_DRIFT_TOLERANCE_MINUTES: int = 5
    
    # JWT / Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET", "precision-agri-secure-token-key-2026")

settings = Settings()
