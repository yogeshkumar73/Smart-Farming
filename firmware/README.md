# ESP32 Smart Precision Agriculture Firmware (M05 & M06)

This firmware implements **Module M05 (Firmware & Sensor Acquisition)** and **Module M06 (IoT Messaging & Ingestion)** of the Smart Precision Agriculture Engineering Blueprint.

---

## 1. Hardware Pinout Map

| Sensor / Component | ESP32 GPIO | Interface | Measurement Range & Specs |
|---|---|---|---|
| Capacitive Soil Moisture v1.2 | `GPIO 34` | ADC1 Channel 6 | 0 - 100% Volumetric Water Content |
| DHT22 / AM2302 Sensor | `GPIO 4` | 1-Wire Digital | -40 to 80°C (±0.5°C), 0-100% RH (±2%) |
| Tipping Bucket Rain Gauge | `GPIO 14` | Interrupt (Falling) | 0.28 mm per pulse bucket tip |
| Status / Indicator LED | `GPIO 2` | Digital Output | Active high |
| RS485 Modbus pH / NPK (Optional) | `GPIO 16 (RX2), 17 (TX2)` | Hardware Serial UART2 | pH: 3–9, N/P/K: 0–1999 mg/kg |

---

## 2. Telemetry Architecture

1. **Edge Sampling & Filter**: 10-sample moving average filter removes ADC electrical noise. Calibration offsets (`moisture_offset`, `temperature_offset`) are applied before range checks.
2. **NTP Timestamps**: Synchronizes with UTC via `pool.ntp.org` and formats RFC 3339 / ISO-8601 strings.
3. **Primary Transport**: MQTT over TCP/TLS to broker on topic:
   ```
   farm/{farm_id}/field/{field_id}/sensor/{device_id}
   ```
4. **Fallback Transport**: If MQTT fails or is unavailable, immediately falls back to HTTP REST:
   ```
   POST /api/v1/readings
   ```
5. **Offline Ring Buffer (SPIFFS)**: When both network transports fail (rural internet loss), readings are appended to `/offline_buffer.jsonl` in flash memory.
6. **Reconnection Replay**: On network recovery, buffered readings are batch-uploaded via:
   ```
   POST /api/v1/readings/sync-batch
   ```
   The backend applies idempotent deduplication based on `(device_id, sequence)` so no duplicates are created.
7. **Ultra-Low Power Cycling**: Automatically triggers ESP32 Deep Sleep between 15-minute sampling windows, extending battery life on solar panel setups.

---

## 3. Required Arduino / PlatformIO Libraries

- `ArduinoJson` (v6.x or v7.x by Benoit Blanchon)
- `PubSubClient` (by Nick O'Leary)
- `DHT sensor library` (by Adafruit)
- `SPIFFS` & `FS` (built-in ESP32 core)
