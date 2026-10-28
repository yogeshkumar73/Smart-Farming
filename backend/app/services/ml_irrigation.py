"""
M08 — Irrigation Prediction
Estimate irrigation or water need from field conditions:
- Rolling soil moisture
- Temperature, humidity, rainfall
- Crop type, growth stage, soil type
- Returns water-need estimate, risk score, confidence, model_version
"""

from typing import Dict, Any, List
from datetime import datetime

# Agronomic water stress sensitivity per growth stage
STAGE_MULTIPLIERS = {
    "flowering": 1.25,
    "grain_filling": 1.25,
    "germination": 1.15,
    "seedling": 1.15,
    "vegetative": 1.10,
    "tillering": 1.10,
    "maturity": 0.85,
}

# Soil field capacity and wilting points
SOIL_HYDROLOGY = {
    "clay": {"field_capacity": 40.0, "wilting_point": 20.0},
    "loamy": {"field_capacity": 30.0, "wilting_point": 12.0},
    "sandy": {"field_capacity": 15.0, "wilting_point": 5.0},
    "silty": {"field_capacity": 32.0, "wilting_point": 14.0},
    "black_cotton": {"field_capacity": 42.0, "wilting_point": 22.0},
    "alluvial": {"field_capacity": 28.0, "wilting_point": 11.0},
}

class IrrigationMLModel:
    model_version: str = "irrigation-regressor-v1.2"

    def predict(
        self,
        field_crop: str,
        growth_stage: str,
        soil_type: str,
        moisture_threshold: float,
        recent_readings: List[Dict[str, Any]],
        forced_confidence: float = None
    ) -> Dict[str, Any]:
        if not recent_readings:
            return {
                "risk_score": 0.0,
                "confidence": 0.0,
                "severity": "low",
                "status": "insufficient_data",
                "model_version": self.model_version,
                "explanation": "No telemetry readings available for field.",
                "recommendation": "Check ESP32 sensor connectivity and power."
            }

        latest = recent_readings[0]
        current_moisture = float(latest.get("moisture", latest.get("soil_moisture", 20.0)))
        current_temp = float(latest.get("temperature", 28.0))
        current_humidity = float(latest.get("humidity", 60.0))
        rainfall_7d = sum(float(r.get("rainfall", 0.0)) for r in recent_readings[:24])

        # Rolling 12-hour average moisture
        window = recent_readings[:12]
        rolling_moisture = sum(float(r.get("moisture", r.get("soil_moisture", current_moisture))) for r in window) / max(1, len(window))

        # Moisture deficit relative to field agronomic threshold
        deficit = moisture_threshold - rolling_moisture
        stage_factor = STAGE_MULTIPLIERS.get(growth_stage.lower(), 1.0)
        
        # Evaporative stress: high temp (>32°C) and low humidity (<40%) accelerate water loss
        evap_stress = 0.0
        if current_temp > 32.0 and current_humidity < 45.0:
            evap_stress = min(15.0, (current_temp - 32.0) * 2.0)

        # Rainfall mitigation
        rain_mitigation = min(20.0, rainfall_7d * 1.5)

        base_risk = (deficit * 5.0 * stage_factor) + evap_stress - rain_mitigation
        risk_score = max(0.0, min(100.0, base_risk))

        confidence = forced_confidence if forced_confidence is not None else 0.88

        if (deficit >= 8.0 and risk_score >= 60.0) or risk_score >= 75.0:
            severity = "high"
            explanation = (
                f"Rolling soil moisture ({rolling_moisture:.1f}%) is {deficit:.1f}% below the {moisture_threshold}% "
                f"critical threshold for {field_crop} during the {growth_stage} stage. Evaporation stress: +{evap_stress:.1f}%."
            )
            recommendation = (
                f"Recommend immediate light furrow/drip irrigation of ~35-45 mm within 12 hours. "
                f"Ensure safety interlock check before energizing pump."
            )
        elif deficit > 0.0:
            severity = "medium"
            explanation = (
                f"Soil moisture ({rolling_moisture:.1f}%) is trending below the {moisture_threshold}% target. "
                f"Recent rainfall: {rainfall_7d:.1f} mm."
            )
            recommendation = "Schedule irrigation within next 36 hours. Inspect canal gate or feeder line."
        else:
            severity = "low"
            explanation = f"Soil moisture ({rolling_moisture:.1f}%) is adequate for {field_crop} ({growth_stage} stage)."
            recommendation = "No irrigation required. Continue routine telemetry monitoring."

        return {
            "risk_score": round(risk_score, 1),
            "confidence": round(confidence, 2),
            "severity": severity,
            "status": "ready" if confidence >= 0.70 else "needs_review",
            "model_version": self.model_version,
            "explanation": explanation,
            "recommendation": recommendation,
            "rolling_moisture": round(rolling_moisture, 1)
        }

irrigation_model = IrrigationMLModel()
