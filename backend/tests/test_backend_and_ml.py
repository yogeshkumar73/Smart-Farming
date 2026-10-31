"""
M17 — Testing & Validation Test Suite
Verifies:
1. Telemetry validation, calibration offsets, and duplicate rejection (M06)
2. Irrigation ML model water deficit calculations (M08)
3. Crop risk ML fungal incubation pattern recognition (M09)
4. Leaf vision quality gate and confidence safety disclaimer (M10)
5. Decision & safety engine confidence gating & alert deduplication (M11 & M12)
6. Health check endpoint (M16)
"""

import sys
import os

# Ensure backend package is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.services.ml_irrigation import irrigation_model
from backend.app.services.ml_crop_risk import crop_risk_model
from backend.app.services.ml_vision import leaf_vision_service
from backend.app.services.decision_engine import decision_engine
from backend.app.routes.readings import validate_and_process_telemetry
from backend.app.database import db_instance
from backend.app.main import app
from fastapi.testclient import TestClient

def test_telemetry_calibration_and_duplicate_detection():
    # Setup
    db_instance.memory_store["sensors"] = [{
        "_id": "sensor_esp32_test",
        "device_id": "ESP32-TEST",
        "calibration": {"moisture_offset": 1.5, "temperature_offset": -0.5}
    }]
    db_instance.memory_store["sensor_readings"] = []

    payload = {
        "device_id": "ESP32-TEST",
        "field_id": "FIELD-001",
        "sequence": 500,
        "soil_moisture": 20.0,
        "temperature": 30.0,
        "humidity": 65.0,
        "rainfall": 0.0,
        "timestamp": "2026-10-28T12:00:00Z"
    }

    # 1. Ingest reading
    res = validate_and_process_telemetry(payload, transport="mqtt")
    assert res["status_code"] == 201
    reading = res["reading"]
    assert reading["moisture"] == 21.5  # 20.0 + 1.5 offset
    assert reading["temperature"] == 29.5  # 30.0 - 0.5 offset

    # 2. Duplicate ingestion should return 409 Conflict
    dup_res = validate_and_process_telemetry(payload, transport="mqtt")
    assert dup_res["status_code"] == 409
    assert "Duplicate event" in dup_res["error"]

def test_irrigation_model_growth_stage_sensitivity():
    recent = [{"moisture": 16.0, "temperature": 34.0, "humidity": 40.0, "rainfall": 0.0}]
    
    # Flowering stage has higher sensitivity multiplier (1.25)
    pred_flowering = irrigation_model.predict(
        field_crop="Wheat",
        growth_stage="flowering",
        soil_type="loamy",
        moisture_threshold=26.0,
        recent_readings=recent
    )
    assert pred_flowering["severity"] == "high"
    assert pred_flowering["risk_score"] > 50.0

    # Maturity stage has lower sensitivity (0.85)
    pred_maturity = irrigation_model.predict(
        field_crop="Wheat",
        growth_stage="maturity",
        soil_type="loamy",
        moisture_threshold=26.0,
        recent_readings=recent
    )
    assert pred_maturity["risk_score"] < pred_flowering["risk_score"]

def test_crop_risk_fungal_incubation():
    # Sustained high humidity (>75%) at moderate temperature (24°C)
    fungal_readings = [
        {"humidity": 88.0, "temperature": 24.0, "rainfall": 2.0} for _ in range(8)
    ]
    pred = crop_risk_model.predict(
        crop="Wheat",
        growth_stage="vegetative",
        recent_readings=fungal_readings
    )
    assert pred["severity"] == "high"
    assert "fungal pathogens" in pred["explanation"].lower()

def test_leaf_vision_safety_gate():
    # Valid preset
    result = leaf_vision_service.analyze(
        field_id="FIELD-001",
        crop="Wheat",
        sample_preset="wheat_stripe_rust"
    )
    assert result["status"] == "ready"
    assert result["confidence"] >= 0.70
    assert "Yellow/Stripe Rust" in result["disease_class"]

    # Low quality / corrupted short base64 triggers quality gate failure
    bad_result = leaf_vision_service.analyze(
        field_id="FIELD-001",
        crop="Wheat",
        sample_preset="wheat_stripe_rust",
        image_base64="short_blur"
    )
    assert bad_result["status"] == "needs_review"
    assert bad_result["confidence"] < 0.70
    assert "70% precision safety threshold" in bad_result["explanation"]

def test_decision_safety_boundary_and_alert_deduplication():
    field = {"_id": "FIELD-001", "name": "North Canal", "crop": "Wheat"}
    irrig_pred = {
        "risk_score": 85.0,
        "severity": "high",
        "explanation": "Critical moisture deficit.",
        "recommendation": "Irrigate immediately."
    }
    crop_risk_pred = {"risk_score": 20.0, "severity": "low"}
    existing_alerts = []

    # 1. High confidence produces active alert
    preds, new_alert = decision_engine.evaluate(
        field=field,
        irrigation_pred=irrig_pred,
        crop_risk_pred=crop_risk_pred,
        existing_alerts=existing_alerts,
        forced_confidence=0.88
    )
    assert new_alert is not None
    assert new_alert["status"] == "active"
    assert new_alert["severity"] == "high"

    # 2. Duplicate active alert is suppressed (Deduplication)
    existing_alerts.append(new_alert)
    _, dup_alert = decision_engine.evaluate(
        field=field,
        irrigation_pred=irrig_pred,
        crop_risk_pred=crop_risk_pred,
        existing_alerts=existing_alerts,
        forced_confidence=0.88
    )
    assert dup_alert is None  # Suppressed!

    # 3. Low confidence (< 0.70) applies safety boundary (prohibits high-severity automated alert)
    low_conf_preds, low_conf_alert = decision_engine.evaluate(
        field=field,
        irrigation_pred=irrig_pred,
        crop_risk_pred=crop_risk_pred,
        existing_alerts=[],
        forced_confidence=0.55
    )
    assert low_conf_alert is None
    assert "SAFETY GATE APPLIED" in low_conf_preds[0]["recommendation"]

def test_fastapi_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "smart-precision-agriculture-fastapi" in data["service"]

def test_task_collaboration_and_safety_interlock():
    client = TestClient(app)
    # 1. Create a task
    create_res = client.post("/api/v1/tasks", json={
        "title": "Inspect Sluice Gate Valve North Canal",
        "description": "Manual physical check required before opening gate.",
        "farmId": "FARM-001",
        "fieldId": "FIELD-001",
        "category": "irrigation",
        "priority": "high",
        "assigneeName": "Rajesh Patel (Lead Farmer)",
        "safetyInterlockRequired": True
    })
    assert create_res.status_code == 201
    task_data = create_res.json()
    task_id = task_data["id"]
    assert task_data["status"] == "todo"
    assert task_data["safetyInterlockRequired"] is True

    # 2. Add collaboration note
    comment_res = client.post(f"/api/v1/tasks/{task_id}/comments", json={
        "authorName": "Dr. Meera Sharma",
        "authorRole": "advisor",
        "content": "Verify root-zone moisture sensor before actuation."
    })
    assert comment_res.status_code == 201
    assert "Verify root-zone moisture" in comment_res.json()["content"]

    # 3. Update task status with safety confirmation
    patch_res = client.patch(f"/api/v1/tasks/{task_id}", json={
        "status": "completed",
        "safetyConfirmedBy": "Rajesh Patel (Lead Farmer)"
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "completed"
    assert updated["safetyConfirmedBy"] == "Rajesh Patel (Lead Farmer)"

    # 4. Filter tasks
    list_res = client.get("/api/v1/tasks?category=irrigation")
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

def test_farms_and_fields_compatibility():
    client = TestClient(app)
    # Test camelCase and snake_case compatibility for farm creation
    farm_res = client.post("/api/v1/farms", json={
        "name": "Barabanki Organic Parcel",
        "district": "Barabanki",
        "state": "Uttar Pradesh",
        "soilType": "alluvial",
        "areaHectares": 3.8
    })
    assert farm_res.status_code == 201
    farm_id = farm_res.json()["_id"]
    assert farm_res.json()["soil_type"] == "alluvial"
    assert farm_res.json()["area"] == 3.8

    # Test camelCase and snake_case compatibility for field creation
    field_res = client.post(f"/api/v1/farms/{farm_id}/fields", json={
        "name": "Barabanki Mustard A",
        "crop": "Mustard",
        "variety": "Pusa Bold",
        "sowingDate": "2026-10-15",
        "growthStage": "vegetative",
        "areaHectares": 1.5,
        "moistureThreshold": 22.0
    })
    assert field_res.status_code == 201
    field_data = field_res.json()
    assert field_data["crop"] == "Mustard"
    assert field_data["moisture_threshold"] == 22.0

if __name__ == "__main__":
    print("Running M17 Testing & Validation Suite...")
    test_telemetry_calibration_and_duplicate_detection()
    print("[PASS] Telemetry calibration and duplicate detection passed")
    test_irrigation_model_growth_stage_sensitivity()
    print("[PASS] Irrigation model growth stage sensitivity passed")
    test_crop_risk_fungal_incubation()
    print("[PASS] Crop risk fungal incubation passed")
    test_leaf_vision_safety_gate()
    print("[PASS] Leaf vision safety gate passed")
    test_decision_safety_boundary_and_alert_deduplication()
    print("[PASS] Decision safety boundary and alert deduplication passed")
    test_fastapi_health_endpoint()
    print("[PASS] FastAPI health endpoint passed")
    test_task_collaboration_and_safety_interlock()
    print("[PASS] Task collaboration and safety interlock passed")
    test_farms_and_fields_compatibility()
    print("[PASS] Farms and fields compatibility passed")
    print("\nALL 8 TEST SUITES PASSED SUCCESSFULLY!")
