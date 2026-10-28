import logging
from typing import Optional, Dict, Any, List
try:
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
    HAS_MOTOR = True
except ImportError:
    AsyncIOMotorClient = Any
    AsyncIOMotorDatabase = Any
    HAS_MOTOR = False
from backend.app.config import settings

logger = logging.getLogger("agripulse.database")

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    is_connected: bool = False

    # In-memory mock store fallback when local MongoDB daemon is not running
    memory_store: Dict[str, List[Dict[str, Any]]] = {
        "users": [],
        "farms": [],
        "fields": [],
        "sensors": [],
        "sensor_readings": [],
        "predictions": [],
        "alerts": [],
        "feedback": []
    }

db_instance = Database()

async def connect_to_mongo():
    if not HAS_MOTOR:
        logger.info("Motor library not installed in environment. Memory collection repository active.")
        db_instance.is_connected = False
        return
    logger.info(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
    try:
        db_instance.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=2000
        )
        # Verify connection
        await db_instance.client.admin.command('ping')
        db_instance.db = db_instance.client[settings.DATABASE_NAME]
        db_instance.is_connected = True
        logger.info(f"Connected successfully to MongoDB database '{settings.DATABASE_NAME}'")
        
        # Initialize Indexes as per Appendix A
        await create_indexes()
    except Exception as e:
        logger.warning(
            f"MongoDB connection failed: {e}. "
            "Falling back to high-performance in-memory collection repository for zero-downtime development."
        )
        db_instance.is_connected = False

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logger.info("Closed MongoDB connection.")

async def create_indexes():
    """
    Recommended indexes from Appendix A:
    - sensor_readings (field_id + timestamp, device_id + sequence)
    - alerts (field_id + created_at)
    - telemetry / device_id + timestamp
    - model_version for model evaluation
    """
    if not db_instance.is_connected or db_instance.db is None:
        return

    try:
        # sensor_readings indexes
        await db_instance.db.sensor_readings.create_index([("field_id", 1), ("timestamp", -1)])
        await db_instance.db.sensor_readings.create_index([("device_id", 1), ("sequence", 1)], unique=True)
        
        # alerts indexes
        await db_instance.db.alerts.create_index([("field_id", 1), ("created_at", -1)])
        await db_instance.db.alerts.create_index([("status", 1)])
        
        # predictions indexes
        await db_instance.db.predictions.create_index([("field_id", 1), ("timestamp", -1)])
        await db_instance.db.predictions.create_index([("model_version", 1)])

        # sensors indexes
        await db_instance.db.sensors.create_index([("device_id", 1)], unique=True)
        await db_instance.db.sensors.create_index([("field_id", 1)])
        
        logger.info("Successfully ensured MongoDB indexes from Appendix A.")
    except Exception as e:
        logger.error(f"Error creating MongoDB indexes: {e}")
