# AgriPulse Command — Smart Precision Agriculture & Collaborative Task Platform

[![Node.js & TypeScript Test Suite](https://img.shields.io/badge/Node%20Tests-5%20Passed-emerald.svg)](#6-testing--verification-evidence)
[![Python Backend & ML Test Suite](https://img.shields.io/badge/Python%20Tests-8%20Passed-blue.svg)](#6-testing--verification-evidence)
[![Zero-Trust Security ABAC](https://img.shields.io/badge/Security-Dirty%20Dozen%20Gated-purple.svg)](#4-security-architecture--zero-trust-abac)
[![Vite Production Build](https://img.shields.io/badge/Vite%20Build-Passing-brightgreen.svg)](#6-testing--verification-evidence)

AgriPulse Command is an enterprise-grade, farmer-first precision agriculture decision-support, telemetry acquisition, and field-team collaboration platform implementing the full **Smart Precision Agriculture Module-Wise Engineering Blueprint**:

$$\text{Sense} \longrightarrow \text{Validate} \longrightarrow \text{Store} \longrightarrow \text{Understand} \longrightarrow \text{Predict} \longrightarrow \text{Decide} \longrightarrow \text{Alert} \longrightarrow \text{Learn}$$

The platform bridges real-world agronomic science with high-frequency IoT telemetry (ESP32 hardware, MQTT QoS 1, HTTP fallback, SPIFFS offline buffer), machine learning models for irrigation deficit and fungal disease risk, an advisory leaf-vision diagnostic pipeline, multi-tenant farm and field parcel management, and real-time multi-user task collaboration with strict human-in-the-loop safety interlocks.

---

## Table of Contents

1. [Architecture & Complete Functional Module Matrix](#1-architecture--complete-functional-module-matrix)
2. [Component Hierarchy & UI Modules](#2-component-hierarchy--ui-modules)
3. [Required Fields & Data Schema Reference](#3-required-fields--data-schema-reference)
4. [Security Architecture & Zero-Trust ABAC](#4-security-architecture--zero-trust-abac)
5. [Firmware & Hardware Specification (M05)](#5-firmware--hardware-specification-m05)
6. [Testing & Verification Evidence](#6-testing--verification-evidence)
7. [Environment Configuration & Quickstart Guide](#7-environment-configuration--quickstart-guide)
8. [API Reference & Endpoints](#8-api-reference--endpoints)

---

## 1. Architecture & Complete Functional Module Matrix

The platform is designed around 17 core modules (M01 to M17) plus an operational Collaborative Field Task Workflow:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AgriPulse Command System                        │
└────────────────────────────────────────────────────────────────────────┘
          │                                              │
 ┌────────▼──────────┐                         ┌─────────▼───────────┐
 │ ESP32 Edge Device │                         │ React Frontend/PWA  │
 │ (M05: Soil, Temp, │                         │ (Vite + Tailwind    │
 │  Humidity, Rain)  │                         │  + WebSocket Client)│
 └────────┬──────────┘                         └─────────▲───────────┘
          │ MQTT (QoS 1) / HTTP Fallback                 │
 ┌────────▼──────────────────────────────────────────────┴───────────┐
 │             Dual-Stack Server Layer (Express.js & FastAPI)        │
 │  - M01: Identity, RBAC & Firebase Auth                            │
 │  - M02 & M03: Farm & Field Registry (Multi-Crop / Phenology)      │
 │  - M04: Sensor Calibration Offsets & Freshness Detector           │
 │  - M06: Ingestion Pipeline & (Device, Seq) Idempotency            │
 │  - M07: Time-Series Storage & Fast Retrieval                      │
 │  - M08 & M09: ML Engine (Irrigation Deficit & Fungal Risk)        │
 │  - M10: Leaf Disease Vision Pipeline (70% Confidence Safety Floor)│
 │  - M11: Decision & Human Safety Interlock Engine                 │
 │  - M12 & M13: Actionable Alerts & Multi-Channel Dispatch          │
 │  - M14: Agronomic Analytics & Moisture vs. Threshold Reporting    │
 │  - M15: Farmer Feedback Ground-Truth & Model Governance           │
 │  - Collaborative Tasks: Real-Time Sync, Presence & Checklist Gate │
 └───────────────────────────────┬───────────────────────────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
 ┌───────────────────────┐                   ┌───────────────────────┐
 │ Cloud Firestore (ABAC)│                   │ MongoDB / Memory Store│
 │ - Zero-Trust Rules    │                   │ - Appendix A Schemas  │
 │ - PII Split Isolation │                   │ - Compound Indexes    │
 └───────────────────────┘                   └───────────────────────┘
```

### Module Responsibilities Breakdown

| Module | Name | Primary Functionality | Implementation Files |
|---|---|---|---|
| **M01** | **Identity & Access Management** | Role-based access control (Farmer, Advisor, Technician, Admin), session tokens, Google Sign-In with Firestore synchronization | `backend/app/routes/auth.py`, `src/firebase.ts`, `server.ts` |
| **M02** | **Farm Management** | Enterprise farm registration, geographic district/state hierarchy, soil classification (`loamy`, `clay`, `sandy`, `alluvial`, `black_cotton`), land area tracking | `backend/app/routes/farms.py`, `server.ts`, `src/components/farms/FarmsFieldsView.tsx` |
| **M03** | **Field & Crop Management** | Crop parcels, seed varieties (e.g. `HD-2967`, `Pusa Bold`), phenological growth stages (`germination` to `maturity`), soil moisture thresholds | `backend/app/routes/fields.py`, `server.ts`, `src/components/farms/FarmsFieldsView.tsx` |
| **M04** | **Device Registry & Health** | Hardware device registry, calibration offsets (`moisture_offset`, `temperature_offset`), battery status %, RSSI dBm, 60-minute freshness window | `backend/app/routes/sensors.py`, `server.ts`, `src/components/sensors/SensorsTelemetryView.tsx` |
| **M05** | **Firmware & Edge Acquisition** | ESP32 C++ firmware, 10-sample moving average filter, NTP synchronization, primary MQTT transport, HTTP fallback, SPIFFS offline circular buffer | `firmware/esp32_smart_agriculture/esp32_smart_agriculture.ino`, `firmware/README.md` |
| **M06** | **IoT Messaging & Ingestion** | Ingestion of telemetry packets, schema validation, range bounding, idempotent deduplication on `(device_id, sequence)` | `backend/app/routes/readings.py`, `server.ts`, `src/utils/agronomyEngine.ts` |
| **M07** | **Telemetry Storage & Trends** | High-performance time-series sensor storage, historical lookups by field and timestamp, multi-metric retrieval | `backend/app/routes/readings.py`, `server.ts`, `backend/app/database.py` |
| **M08** | **Irrigation Prediction Engine** | Evapotranspiration modeling, soil moisture deficit calculation, growth stage sensitivity multipliers (e.g., 1.25× during flowering) | `backend/app/services/ml_irrigation.py`, `src/utils/agronomyEngine.ts` |
| **M09** | **Crop & Environment Risk** | Fungal pathogen incubation recognition (sustained humidity > 80% with 20–28°C temperatures), heat stress, frost warnings | `backend/app/services/ml_crop_risk.py`, `src/utils/agronomyEngine.ts` |
| **M10** | **Leaf Disease Vision Pipeline** | Pre-inference image quality gate (blur, resolution, exposure), disease classification, strict $\ge 70\%$ confidence safety floor | `backend/app/services/ml_vision.py`, `backend/app/routes/disease.py`, `server.ts`, `src/components/disease/DiseaseDetectionView.tsx` |
| **M11** | **Decision & Safety Engine** | Gating low-confidence outputs (`status = 'needs_review'`), mandatory physical human confirmation before pump/valve actuation | `backend/app/services/decision_engine.py`, `src/utils/agronomyEngine.ts` |
| **M12** | **Alerts & Recommendations** | Plain-language actionable next step first, "what was observed", "why it matters", limitations disclaimer, idempotent alert deduplication | `backend/app/routes/alerts.py`, `server.ts`, `src/components/alerts/AlertsDecisionView.tsx` |
| **M13** | **Notification Delivery** | In-app notification queue, simulated SMS dispatch for high-severity alerts, push notification registry | `backend/app/routes/notifications.py`, `server.ts` |
| **M14** | **Analytics & Reporting** | Rolling 24-hour averages, 7-day cumulative rainfall, water deficit status, active alert counters, historical trend charts | `backend/app/routes/analytics.py`, `server.ts`, `src/components/analytics/AnalyticsBlueprintView.tsx` |
| **M15** | **Feedback & Model Governance** | Field-level ground-truth feedback collection (`accurate_helpful`, `false_alarm`, `too_late`, `needs_calibration`) to close the learning loop | `backend/app/routes/feedback.py`, `server.ts`, `src/components/alerts/AlertsDecisionView.tsx` |
| **M16** | **Security & Operations** | Zero-trust ABAC rules, PII isolation, rate limiting, system health monitoring | `firestore.rules`, `security_spec.md`, `backend/app/main.py`, `server.ts` |
| **M17** | **Testing & Validation** | Automated regression test suites for agronomic calculations, duplicate rejection, safety gates, and security rules | `src/utils/agronomyEngine.test.ts`, `firestore.rules.test.ts`, `backend/tests/test_backend_and_ml.py` |
| **Tasks** | **Collaborative Field Workflow** | Real-time task board, team presence indicators, assignee tracking, subcollection comments, safety checklist gate | `src/components/tasks/TaskCollaborationView.tsx`, `backend/app/routes/tasks.py`, `server.ts` |

---

## 2. Component Hierarchy & UI Modules

The frontend is constructed following a strict 3-zone layout with hairline dividers, high contrast, and accessible UI controls:

1. **AgriPulse Command Bar (`header`)**:
   - Zone 1: Wordmark branding and home anchor.
   - Zone 2: Navigation tabs (`Dashboard`, `Tasks`, `Sensors`, `Disease Vision`, `Alerts & Feedback`).
   - Zone 3: Primary CTA button (`+ Create Field Task`).
2. **Context & Workspace Strip**:
   - Global Field Parcel Selector (`FIELD-001`, `FIELD-002`, `FIELD-003`, or `All Fields`).
   - Secondary Module Switches (`Farms & Parcels Registry`, `Analytics & Blueprint`).
   - Live WebSocket Sync Indicator & Active Collaborator Counter.
   - Role Selector (`Farmer`, `Agri Advisor`, `IoT Technician`).
   - Internationalization Language Selector (`English`, `हिन्दी`, `Español`).
   - Google Authentication State (Cloud Firestore Sync status and sign-in button).
3. **Core Interactive Views**:
   - `DashboardView`: Focal actionable next-step banner, live telemetry strip (Moisture, Temp/Humidity, pH/NPK, ESP32 status), open tasks summary, and active alerts list.
   - `TaskCollaborationView`: Kanban/list task board, category and status filters, creation modal with validation errors, task comment thread, and human-in-the-loop safety interlock check before completing high-impact tasks.
   - `FarmsFieldsView`: Farm registry, crop variety and growth stage management, area configuration, and moisture threshold tuning.
   - `SensorsTelemetryView`: Active hardware node status cards, device registration modal, manual telemetry injection simulator, and offline SPIFFS circular buffer replay tester.
   - `DiseaseDetectionView`: Leaf image upload / sample preset selector, image quality gate results, disease classification diagnosis, model confidence gauge, and "Create Follow-Up Task" button.
   - `AlertsDecisionView`: Plain-language recommendations, severity badge, acknowledgment/resolution buttons, and farmer feedback form (`accurate_helpful`, `false_alarm`, `too_late`, `needs_calibration`).
   - `AnalyticsBlueprintView`: 24-hour sensor trends, moisture vs. threshold comparisons, 7-day rainfall, and architectural blueprint compliance reference.

---

## 3. Required Fields & Data Schema Reference

The system enforces strict schema validation across both frontend forms, Express.js REST/WebSocket handlers, and FastAPI Pydantic models. Both camelCase and snake_case payloads are supported for full cross-platform compatibility:

### 1. Farm Entity (`POST /api/v1/farms`)
| Field Name | Type | Required | Constraints / Validation |
|---|---|---|---|
| `name` | string | **Yes** | 2 to 100 characters |
| `district` | string | **Yes** | Non-empty district name |
| `state` | string | **Yes** | Non-empty state name |
| `soil_type` / `soilType` | string | **Yes** | Enum: `loamy`, `clay`, `sandy`, `silty`, `black_cotton`, `alluvial` |
| `area_hectares` / `areaHectares` | number | **Yes** | Positive float > 0.0 (e.g., 2.5) |
| `ownerId` / `user_id` | string | No | Defaults to authenticated user or `demo-farmer-01` |

### 2. Field Parcel Entity (`POST /api/v1/farms/{farm_id}/fields`)
| Field Name | Type | Required | Constraints / Validation |
|---|---|---|---|
| `farm_id` / `farmId` | string | **Yes** | Must match an existing registered Farm ID |
| `name` | string | **Yes** | 2 to 120 characters |
| `crop` | string | **Yes** | Non-empty crop name (e.g. `Wheat`, `Mustard`, `Rice`) |
| `variety` | string | **Yes** | Non-empty seed variety (e.g. `HD-2967`, `Pusa Bold`) |
| `sowing_date` / `sowingDate` | string | **Yes** | ISO-8601 Date (`YYYY-MM-DD`) |
| `growth_stage` / `growthStage` | string | **Yes** | Enum: `germination`, `seedling`, `vegetative`, `tillering`, `flowering`, `grain_filling`, `maturity` |
| `area` / `areaHectares` | number | **Yes** | Positive float > 0.0 |
| `moisture_threshold` / `moistureThreshold` | number | **Yes** | Bounded float: 5.0% to 50.0% |
| `soil_characteristics` | object | No | `{ phTarget: float, organicMatterPct: float, drainage: string }` |

### 3. Sensor Node Entity (`POST /api/v1/sensors/register`)
| Field Name | Type | Required | Constraints / Validation |
|---|---|---|---|
| `device_id` | string | **Yes** | 3 to 64 alphanumeric characters with hyphens (e.g. `ESP32-001`) |
| `field_id` | string | **Yes** | Must match a registered Field ID |
| `firmware_version` | string | No | Semantic version string, defaults to `1.2.0` |
| `moisture_offset` | number | No | Additive calibration offset: -15.0% to +15.0% |
| `temperature_offset` | number | No | Additive temperature offset: -5.0°C to +5.0°C |

### 4. Telemetry Reading Entity (`POST /api/v1/readings`)
| Field Name | Type | Required | Constraints / Validation |
|---|---|---|---|
| `device_id` | string | **Yes** | Hardware identifier |
| `field_id` | string | **Yes** | Target field parcel |
| `sequence` | integer | **Yes** | Strictly increasing monotonic sequence counter (Idempotency key) |
| `timestamp` | string | **Yes** | UTC ISO-8601 timestamp within freshness window (not future-dated) |
| `soil_moisture` | number | **Yes** | Bounded: 0.0% to 100.0% |
| `temperature` | number | **Yes** | Bounded: -20.0°C to +65.0°C |
| `humidity` | number | **Yes** | Bounded: 0.0% to 100.0% RH |
| `rainfall` | number | No | Cumulative precipitation (mm) |
| `ph` | number | No | Bounded: 3.0 to 10.0 |
| `nitrogen` / `phosphorus` / `potassium` | number | No | Soil nutrient concentrations (mg/kg) |
| `transport` | string | No | Enum: `mqtt`, `http_fallback`, `offline_buffer_sync` |

### 5. Collaborative Field Task Entity (`POST /api/v1/tasks`)
| Field Name | Type | Required | Constraints / Validation |
|---|---|---|---|
| `title` | string | **Yes** | 3 to 160 characters |
| `description` | string | **Yes** | Up to 1000 characters |
| `farmId` / `farm_id` | string | **Yes** | Valid registered farm ID |
| `fieldId` / `field_id` | string | **Yes** | Valid registered field ID |
| `category` | string | **Yes** | Enum: `irrigation`, `scouting`, `sensor_maintenance`, `soil_nutrition`, `disease_management` |
| `priority` | string | **Yes** | Enum: `low`, `medium`, `high` |
| `assigneeName` / `assignee_name` | string | **Yes** | Name of field operator / advisor |
| `dueDate` / `due_date` | string | **Yes** | Date string (`YYYY-MM-DD`) |
| `safetyInterlockRequired` | boolean | No | When `true`, task cannot be set to `completed` without safety confirmation |
| `safetyConfirmedBy` | string | Cond. | Required when completing a task with safety interlock active |

### 6. Farmer Feedback Entity (`POST /api/v1/feedback`)
| Field Name | Type | Required | Constraints / Validation |
|---|---|---|---|
| `prediction_id` | string | **Yes** | Traceable prediction identifier |
| `field_id` | string | **Yes** | Associated field parcel |
| `farmer_label` | string | **Yes** | Enum: `accurate_helpful`, `false_alarm`, `too_late`, `needs_calibration` |
| `comment` | string | **Yes** | Ground-truth field observation (min 2 characters) |

---

## 4. Security Architecture & Zero-Trust ABAC

AgriPulse Command adheres to strict Attribute-Based Access Control (ABAC) and Principle of Least Privilege across all persistent datastores.

### The 8 Pillars of Security

1. **Global Default Deny**: Every Firestore match rule defaults to `allow read, write: if false;` unless explicitly authorized.
2. **Verified Identity Gate**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Split Isolation**: Sensitive user information (`phone`, `email`) is kept strictly under `/users/{userId}/private/{infoId}`, accessible only by the account owner or verified platform admin. Public collaborator profiles live under `/users/{userId}/public/profile`.
4. **Relational Master Integrity Gates**:
   - A `Field` cannot be registered unless `/farms/$(incoming().farmId)` exists and is owned by `request.auth.uid`.
   - A `Task` cannot be created unless both `/farms/$(incoming().farmId)` and `/fields/$(incoming().fieldId)` exist.
   - A `TaskComment` can only be authored by either the task owner or designated assignee.
5. **Terminal State Locking**: When a task reaches `status == 'completed'`, non-admin users cannot mutate its contents or reopen it.
6. **Temporal Immutability**: `createdAt` must equal `request.time` on creation and remains strictly immutable on subsequent updates. `updatedAt` must equal `request.time`. `ownerId` cannot be changed.
7. **Query Enforcer (`allow list`)**: List queries are strictly scoped with `resource.data.ownerId == request.auth.uid` to prevent blanket collection scraping.
8. **Path ID Poisoning Defense**: All path parameters are validated to ensure `id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`.

### The "Dirty Dozen" Threat Suite Verification

The security test suite (`firestore.rules.test.ts`) verifies that all 12 malicious attack vectors return `PERMISSION_DENIED`:

```
✓ 1_shadow_field_injection ................ REJECTED (hasOnly strict whitelist)
✓ 2_identity_spoofing_farm ................ REJECTED (ownerId == request.auth.uid)
✓ 3_unverified_email_spoof ................ REJECTED (email_verified == true)
✓ 4_pii_lateral_read ...................... REJECTED (isOwner(userId) || isAdmin())
✓ 5_id_poisoning_2kb ...................... REJECTED (isValidId max 128 chars regex)
✓ 6_orphaned_field_create ................. REJECTED (exists(/farms/$(farmId)))
✓ 7_tier2_assignee_privilege_escalation ... REJECTED (affectedKeys whitelist)
✓ 8_terminal_state_reopen ................. REJECTED (status != 'completed')
✓ 9_value_poisoning_update ................ REJECTED (isValidTask validation)
✓ 10_client_forged_timestamp .............. REJECTED (createdAt == request.time)
✓ 11_unauthorized_subcollection_comment ... REJECTED (task membership check)
✓ 12_blanket_list_query_scraping .......... REJECTED (resource.data scoping)
```

---

## 5. Firmware & Hardware Specification (M05)

The hardware node firmware (`firmware/esp32_smart_agriculture/esp32_smart_agriculture.ino`) is designed for off-grid ESP32 microcontrollers deployed in rural farming environments:

### Hardware Pinout Configuration

| Component / Sensor | Interface | ESP32 GPIO | Operating Range & Accuracy |
|---|---|---|---|
| **Capacitive Soil Moisture v1.2** | Analog (ADC1) | `GPIO 34` | 0 – 100% Volumetric Water Content |
| **DHT22 / AM2302** | 1-Wire Digital | `GPIO 4` | -40 to 80°C (±0.5°C), 0–100% RH (±2%) |
| **Tipping Bucket Rain Gauge** | Falling Edge IRQ | `GPIO 14` | 0.28 mm per pulse bucket tip |
| **Status / Error LED** | Digital Output | `GPIO 2` | Active HIGH indicator |
| **RS485 Modbus pH / NPK (Optional)** | UART2 (RX2/TX2) | `GPIO 16, 17` | pH 3–9, NPK 0–1999 mg/kg |

### Edge Fault Tolerance & Offline Recovery

1. **Noise Filtering**: A 10-sample rolling average filter rejects electrical interference from solar inverters and submersible pump motors.
2. **NTP Timestamping**: Real-time clocks sync against `pool.ntp.org` and output RFC 3339 formatted timestamps.
3. **Primary Transport**: MQTT QoS 1 to topic `farm/{farm_id}/field/{field_id}/sensor/{device_id}`.
4. **Secondary Transport**: Automatic fallback to `POST /api/v1/readings` when the MQTT socket times out.
5. **SPIFFS Offline Ring Buffer**: During internet outages, readings are appended to `/offline_buffer.jsonl` in flash memory.
6. **Idempotent Batch Replay**: On network reconnection, buffered events are submitted to `POST /api/v1/readings/sync-batch`. The backend rejects duplicate `(device_id, sequence)` pairs without error, ensuring no duplicate alerts or skewed analytics.
7. **Deep Sleep Power Cycling**: Automatically triggers ESP32 Deep Sleep between 15-minute sampling windows, extending battery life on solar panel setups.

---

## 6. Testing & Verification Evidence

All test suites across the stack pass with zero failures:

### 1. Frontend & Security Rules Test Suite (`npm test`)
```bash
> react-example@0.0.0 test
> tsx --test src/utils/agronomyEngine.test.ts firestore.rules.test.ts

TAP version 13
ok 1 - Firestore Security Rules — Dirty Dozen Payloads all return PERMISSION_DENIED
ok 2 - validateAndCalibrateTelemetry validates contract, applies offsets, and flags stale data
ok 3 - isDuplicateReading detects duplicate (device_id, sequence) idempotently
ok 4 - evaluateIrrigationAndRiskDecision gates low confidence and deduplicates active alerts
ok 5 - validateTaskInput and upsertCollaborativeTask enforce schema and idempotency
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# duration_ms 741.1818
```

### 2. Python Backend & ML Test Suite (`npm run test:backend`)
```bash
> react-example@0.0.0 test:backend
> python -m pytest backend/tests/test_backend_and_ml.py

============================= test session starts =============================
platform win32 -- Python 3.11.2, pytest-9.1.1, pluggy-1.6.0
collected 8 items

backend\tests\test_backend_and_ml.py ........                            [100%]

======================== 8 passed in 2.55s =========================
```
Verified backend test cases:
- `test_telemetry_calibration_and_duplicate_detection`: Verifies sensor calibration offsets and 409 Conflict duplicate rejection.
- `test_irrigation_model_growth_stage_sensitivity`: Proves flowering stage sensitivity (1.25×) yields higher risk than maturity (0.85×).
- `test_crop_risk_fungal_incubation`: Verifies fungal pathogen alerts when humidity > 80% is sustained.
- `test_leaf_vision_safety_gate`: Tests the 70% confidence safety threshold on leaf images.
- `test_decision_safety_boundary_and_alert_deduplication`: Verifies suppression of duplicate active alerts and confidence gating.
- `test_fastapi_health_endpoint`: Checks `/health` endpoint status.
- `test_task_collaboration_and_safety_interlock`: Tests task creation, commenting, and safety interlock confirmation.
- `test_farms_and_fields_compatibility`: Verifies seamless support for both camelCase and snake_case payloads.

### 3. TypeScript Typecheck (`npm run lint`)
```bash
> react-example@0.0.0 lint
> tsc --noEmit
# Exits with code 0 (Zero TypeScript errors)
```

### 4. Production Client Build (`npm run build`)
```bash
> react-example@0.0.0 build
> vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 1689 modules transformed.
rendering chunks...
dist/index.html                   1.73 kB │ gzip:   0.72 kB
dist/assets/index-DaplJy4i.css   26.26 kB │ gzip:   5.68 kB
dist/assets/index-bDCbzy7y.js   906.91 kB │ gzip: 266.44 kB
✓ built in 1.40s
```

---

## 7. Environment Configuration & Quickstart Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

### Environment Variables (`.env`)
Create a `.env` file in the project root:

```ini
# Application Port
PORT=3000

# Google Gemini API Key (Optional: for live generative agronomic leaf disease analysis)
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Connection (Optional: falls back automatically to high-speed in-memory store)
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=smart_precision_agriculture

# MQTT Broker (Optional: defaults to local broker)
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
```

### Starting the Application

#### 1. Full-Stack Web Application (Node / Express / Vite / WebSocket)
```bash
# Install dependencies
npm install --legacy-peer-deps

# Run test suites
npm test

# Run TypeScript type check
npm run lint

# Start server and live PWA frontend on Port 3000
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

#### 2. Python FastAPI Backend & ML Server
```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Run pytest test suite
npm run test:backend

# Launch FastAPI server on Port 8000
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger API documentation: **[http://localhost:8000/docs](http://localhost:8000/docs)**.

---

## 8. API Reference & Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check & service connectivity status |
| `POST` | `/api/v1/auth/login` | Authenticate user and receive session token |
| `GET` | `/api/v1/farms` | List all registered farms |
| `POST` | `/api/v1/farms` | Register a new farm |
| `GET` | `/api/v1/farms/{farm_id}/fields` | List field parcels for a farm |
| `POST` | `/api/v1/farms/{farm_id}/fields` | Create a new crop field parcel |
| `GET` | `/api/v1/fields/{field_id}` | Fetch field parcel details |
| `PATCH`| `/api/v1/fields/{field_id}` | Update field growth stage or moisture threshold |
| `GET` | `/api/v1/sensors` | List all registered ESP32 sensors |
| `POST` | `/api/v1/sensors/register` | Register a new sensor node with calibration offsets |
| `POST` | `/api/v1/readings` | Ingest single sensor reading (MQTT or HTTP fallback) |
| `POST` | `/api/v1/readings/sync-batch` | Batch sync buffered offline SPIFFS readings |
| `GET` | `/api/v1/readings` | Query historical sensor readings |
| `GET` | `/api/v1/predictions/{field_id}`| Get current ML model predictions |
| `POST` | `/api/v1/disease/analyze` | Run leaf disease vision pipeline and quality checks |
| `GET` | `/api/v1/alerts` | List active, acknowledged, or resolved alerts |
| `PATCH`| `/api/v1/alerts/{alert_id}` | Acknowledge or resolve an agronomic alert |
| `POST` | `/api/v1/feedback` | Submit farmer ground-truth evaluation for model learning |
| `GET` | `/api/v1/analytics/{field_id}` | Get 24-hour averages, rainfall, and water stress metrics |
| `GET` | `/api/v1/tasks` | List collaborative field tasks with status/category filters |
| `POST` | `/api/v1/tasks` | Create a new field task with safety interlock setting |
| `PATCH`| `/api/v1/tasks/{task_id}` | Update task status or confirm human safety interlock |
| `DELETE`| `/api/v1/tasks/{task_id}` | Remove a collaborative field task |
| `POST` | `/api/v1/tasks/{task_id}/comments` | Add a real-time collaborative note to a task |

---

## 9. License

This project is licensed under the MIT License — designed for precision agriculture research, open telemetry standards, and field-team collaboration.
