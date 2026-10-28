"""
M06 — IoT Messaging & Ingestion Service
- Topic convention: farm/{farm_id}/field/{field_id}/sensor/{device_id}
- Authenticate device and parse payload
- Validate schema, normalize units and handle duplicate messages
- Provide HTTP telemetry fallback
"""

import json
import logging
from typing import Optional, Callable
try:
    import paho.mqtt.client as mqtt
    HAS_PAHO_MQTT = True
except ImportError:
    mqtt = None
    HAS_PAHO_MQTT = False
from backend.app.config import settings

logger = logging.getLogger("agripulse.mqtt")

class MQTTService:
    def __init__(self):
        self.client: Optional[mqtt.Client] = None
        self.is_connected: bool = False
        self.telemetry_handler: Optional[Callable] = None

    def set_handler(self, handler: Callable):
        self.telemetry_handler = handler

    def start(self):
        if not HAS_PAHO_MQTT:
            logger.info("paho-mqtt library not installed in environment. MQTT ingestion ready via HTTP REST fallback.")
            return
        try:
            self.client = mqtt.Client(
                client_id="agripulse_backend_fastapi",
                protocol=mqtt.MQTTv311
            )
            self.client.on_connect = self._on_connect
            self.client.on_message = self._on_message
            self.client.on_disconnect = self._on_disconnect

            logger.info(f"Connecting MQTT client to {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}...")
            self.client.connect_async(
                settings.MQTT_BROKER_HOST,
                settings.MQTT_BROKER_PORT,
                keepalive=60
            )
            self.client.loop_start()
        except Exception as e:
            logger.warning(f"Could not connect to MQTT broker ({e}). Telemetry ingestion remains fully active via HTTP REST fallback.")

    def stop(self):
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("MQTT client disconnected.")

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.is_connected = True
            logger.info(f"Connected to MQTT broker! Subscribing to: {settings.MQTT_TOPIC_SUBSCRIPTION}")
            client.subscribe(settings.MQTT_TOPIC_SUBSCRIPTION)
        else:
            logger.warning(f"MQTT connect returned error code: {rc}")

    def _on_disconnect(self, client, userdata, rc):
        self.is_connected = False
        logger.info(f"MQTT disconnected (rc={rc})")

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload_str = msg.payload.decode("utf-8")
            data = json.loads(payload_str)
            logger.info(f"[MQTT Received] Topic: {topic}, Sequence: {data.get('sequence')}")

            # Extract topic tokens: farm/{farm_id}/field/{field_id}/sensor/{device_id}
            parts = topic.split("/")
            if len(parts) >= 6:
                farm_id = parts[1]
                field_id = parts[3]
                device_id = parts[5]
                data.setdefault("field_id", field_id)
                data.setdefault("device_id", device_id)

            if self.telemetry_handler:
                self.telemetry_handler(data, transport="mqtt")
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")

mqtt_service = MQTTService()
