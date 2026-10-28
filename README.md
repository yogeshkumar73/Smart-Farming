# AgriPulse Command — Smart Precision Agriculture

AgriPulse Command is a farmer-first precision-agriculture decision-support, telemetry acquisition, and field-team collaboration platform implementing the full **Smart Precision Agriculture Module-Wise Design Blueprint**:

$$\text{Sense} \longrightarrow \text{Validate} \longrightarrow \text{Store} \longrightarrow \text{Understand} \longrightarrow \text{Predict} \longrightarrow \text{Decide} \longrightarrow \text{Alert} \longrightarrow \text{Learn}$$

---

## 1. System Architecture & Functional Modules

| Module ID | Module Name | Primary Responsibilities | APIs / Tech Stack |
|---|---|---|---|
| **M01** | **Identity & Access Management** | Farmer login, RBAC (farmer, advisor, technician, admin), JWT & session handling | `POST /api/v1/auth/login`, MongoDB `users` collection |
| **M02** | **Farm Management** | Register and list farms, location, soil type, and hectare area | `GET/POST /api/v1/farms`, MongoDB `farms` collection |
| **M03** | **Field & Crop Management** | Parcel boundaries, crop type, variety, sowing date, growth stage, soil characteristics | `GET /api/v1/fields/{id}`, `GET/POST /api/v1/farms/{id}/fields` |
| **M04** | **Device Registry & Health** | Device registration, battery %, RSSI dBm, calibration offsets, health status | `GET/POST /api/v1/sensors/register`, `sensors` collection |
| **M05** | **Firmware & Sensor Acquisition** | ESP32 C++ firmware, capacitive soil moisture, DHT22, rain gauge, RS485 NPK, SPIFFS offline buffer | Arduino C++ (`firmware/esp32_smart_agriculture/`) |
| **M06** | **IoT Messaging & Ingestion** | MQTT topic `farm/{id}/field/{id}/sensor/{id}`, schema validation, duplicate filtering, HTTP fallback | `POST /api/v1/readings`, `POST /api/v1/readings/sync-batch` |
| **M07** | **Telemetry Storage & Trends** | Indexed telemetry storage, historical queries by field and time range, trend analysis | `GET /api/v1/readings`, `sensor_readings` collection |
| **M08** | **Irrigation Prediction** | Rolling 12-24h soil moisture trends, growth stage sensitivity multipliers, evapotranspiration | `IrrigationMLModel`, `predictions` collection |
| **M09** | **Crop & Environment Risk** | Fungal incubation detection (sustained RH > 80% + 20-28°C), heat stress, frost warnings | `CropRiskMLModel`, `predictions` collection |
| **M10** | **Leaf Disease Vision** | Quality gate (blur, exposure, resolution), disease inference, $\ge 70\%$ confidence threshold | `POST /api/v1/disease/analyze` |
| **M11** | **Decision & Safety Engine** | Agronomic safety boundary, human-in-the-loop interlock before pump energizing, low-confidence lockout | `DecisionAndSafetyEngine` |
| **M12** | **Alerts & Recommendations** | Plain-language actionable alerts, explanation, next steps, idempotent deduplication | `GET /api/v1/alerts`, `PATCH /api/v1/alerts/{id}` |
| **M13** | **Notification Delivery** | Dashboard in-app alerts, SMS dispatch simulator, push alerts | `GET/POST /api/v1/notifications` |
| **M14** | **Analytics & Reporting** | Soil moisture vs. threshold trends, 24h averages, 7-day rainfall, farm health cards | `GET /api/v1/analytics/{field_id}` |
| **M15** | **Feedback & Model Governance** | Farmer feedback collection (accurate/helpful, false alarm, needs calibration), model traceability | `POST /api/v1/feedback`, `feedback` collection |
| **M16** | **Security & Operations** | TLS/MQTT authentication, rate limiting, health observability | `GET /health` |
| **M17** | **Testing & Field Validation** | Unit, integration, calibration, duplicate rejection, and safety tests | `npm test`, `python backend/tests/test_backend_and_ml.py` |

---

## 2. Appendix A — MongoDB Collection Schema

- **`users`**: `_id`, `name`, `phone`, `language`, `role`, `created_at`
- **`farms`**: `_id`, `user_id`, `name`, `location: {district, state}`, `soil_type`, `area`, `created_at`
- **`fields`**: `_id`, `farm_id`, `crop`, `variety`, `sowing_date`, `growth_stage`, `area`, `moisture_threshold`, `soil_characteristics`
- **`sensors`**: `_id`, `field_id`, `device_id`, `type`, `unit`, `status`, `calibration: {moisture_offset, temperature_offset}`, `last_seen`
- **`sensor_readings`**: `_id`, `sensor_id`, `field_id`, `device_id`, `sequence`, `timestamp`, `moisture`, `temperature`, `humidity`, `rainfall`, `ph`, `nitrogen`, `phosphorus`, `potassium`, `transport`
- **`predictions`**: `_id`, `field_id`, `timestamp`, `type`, `risk_score`, `confidence`, `severity`, `status`, `model_version`, `explanation`, `recommendation`
- **`alerts`**: `_id`, `field_id`, `prediction_id`, `type`, `severity`, `message`, `recommendation`, `confidence`, `status`, `created_at`, `updated_at`, `occurrence_count`
- **`feedback`**: `_id`, `prediction_id`, `field_id`, `farmer_label`, `comment`, `model_version`, `created_at`

### Indexes
- `sensor_readings`: Compound index on `(field_id, timestamp)` and unique index on `(device_id, sequence)`
- `alerts`: Compound index on `(field_id, created_at)` and index on `(status)`
- `predictions`: Compound index on `(field_id, timestamp)` and index on `(model_version)`
- `sensors`: Unique index on `(device_id)` and index on `(field_id)`

---

## 3. Quickstart & Running the Application

### A. React / PWA Frontend & Node Server (TypeScript / Vite / Express)
```bash
# Install dependencies
npm install --legacy-peer-deps

# Run Unit Tests
npm test

# Run Typecheck & Build
npm run lint
npm run build

# Start Full Stack App & Dev Server (Port 3000)
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

### B. Python FastAPI Backend & ML Engine
```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Run Python M17 Test Suite
python backend/tests/test_backend_and_ml.py

# Launch FastAPI Server (Port 8000)
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger API documentation: [http://localhost:8000/docs](http://localhost:8000/docs).

---

### C. ESP32 Arduino Firmware (M05)
Open `firmware/esp32_smart_agriculture/esp32_smart_agriculture.ino` in Arduino IDE or PlatformIO.
Configure your Wi-Fi SSID and MQTT broker IP, then flash to any standard ESP32 development board.

---

## 4. Key Acceptance Checks (Appendix C)

- [x] **Sensor calibration & range validation**: Raw readings calibrated with offsets and boundary-checked.
- [x] **Network loss & offline synchronization**: SPIFFS circular buffer holds offline telemetry; replay API applies idempotent `(device_id, sequence)` deduplication.
- [x] **REST APIs tested**: Authentication, farms, fields, sensors, readings, predictions, alerts, analytics, feedback.
- [x] **Safety boundary**: Confidence gating ensures predictions below 70% confidence do not trigger automated high-impact actions; pump control mandates human confirmation.
- [x] **Alert deduplication**: Deduplicates active alerts by field and type to prevent alarm fatigue.
- [x] **PWA & Field Readiness**: Service Worker caching, manifest.json, multi-language UI (English, Hindi, Spanish).
