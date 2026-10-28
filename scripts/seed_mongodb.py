"""
MongoDB Initializer & Migration Script (Appendix A)
Creates collections, ensures indexes, and seeds baseline records:
- users
- farms
- fields
- sensors
- sensor_readings
- predictions
- alerts
- feedback
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from motor.motor_asyncio import AsyncIOMotorClient
from backend.app.config import settings

async def seed_mongodb():
    print(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    print("Ensuring indexes as per Appendix A...")
    await db.sensor_readings.create_index([("field_id", 1), ("timestamp", -1)])
    await db.sensor_readings.create_index([("device_id", 1), ("sequence", 1)], unique=True)
    await db.alerts.create_index([("field_id", 1), ("created_at", -1)])
    await db.alerts.create_index([("status", 1)])
    await db.predictions.create_index([("field_id", 1), ("timestamp", -1)])
    await db.predictions.create_index([("model_version", 1)])
    await db.sensors.create_index([("device_id", 1)], unique=True)
    await db.sensors.create_index([("field_id", 1)])

    print("Seeding initial farm, field, sensor, and reading records...")
    # Upsert Farm
    await db.farms.update_one(
        {"_id": "FARM-001"},
        {"$set": {
            "_id": "FARM-001",
            "user_id": "demo-farmer-01",
            "name": "Karnal Precision Agro Research Farm",
            "location": {"district": "Karnal", "state": "Haryana"},
            "soil_type": "loamy",
            "area": 4.5,
            "created_at": "2026-09-01T06:00:00Z"
        }},
        upsert=True
    )

    # Upsert Fields
    await db.fields.update_one(
        {"_id": "FIELD-001"},
        {"$set": {
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
        }},
        upsert=True
    )

    # Upsert Sensors
    await db.sensors.update_one(
        {"device_id": "ESP32-001"},
        {"$set": {
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
        }},
        upsert=True
    )

    print("MongoDB successfully initialized and seeded with Appendix A collections!")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_mongodb())
