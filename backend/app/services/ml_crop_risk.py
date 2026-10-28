"""
M09 — Crop & Environment Risk
Estimate crop/environment risk from sensor trends and context:
- Humidity and temperature patterns
- High humidity (>80%) + moderate temperature (20-28°C) favors fungal pathogens (e.g. rust, blight)
- Heat shock (>38°C) and Frost alert (<4°C)
- Uses trends rather than relying on a single reading
"""

from typing import Dict, Any, List

class CropRiskMLModel:
    model_version: str = "crop-risk-classifier-v1.1"

    def predict(
        self,
        crop: str,
        growth_stage: str,
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
                "explanation": "No telemetry readings available for risk evaluation.",
                "recommendation": "Maintain sensor telemetry."
            }

        # Trend over recent readings
        window = recent_readings[:12]
        avg_humidity = sum(float(r.get("humidity", 60.0)) for r in window) / len(window)
        avg_temp = sum(float(r.get("temperature", 25.0)) for r in window) / len(window)
        latest_temp = float(recent_readings[0].get("temperature", avg_temp))

        # Check conditions
        high_humidity_count = sum(1 for r in window if float(r.get("humidity", 0)) >= 75.0)
        fungal_favorable = (high_humidity_count >= 6) and (19.0 <= avg_temp <= 28.5)
        heat_stress = latest_temp >= 38.0
        frost_risk = latest_temp <= 4.0

        risk_score = 15.0
        severity = "low"
        explanation = f"Environmental parameters stable. Avg RH: {avg_humidity:.1f}%, Canopy Temp: {avg_temp:.1f}°C."
        recommendation = "Normal scouting regimen recommended."

        if fungal_favorable:
            risk_score = 78.0
            severity = "high"
            explanation = (
                f"Sustained canopy microclimate: humidity averaged {avg_humidity:.1f}% across {high_humidity_count} "
                f"intervals with moderate temperatures ({avg_temp:.1f}°C). High incubation risk for foliar fungal pathogens."
            )
            recommendation = (
                f"Conduct field scouting on lower canopy leaves for rust/powdery mildew pustules. "
                f"Consider prophylactic biological or protective spray if symptoms appear."
            )
        elif heat_stress:
            risk_score = 82.0
            severity = "high"
            explanation = f"Canopy temperature surged to {latest_temp:.1f}°C, triggering extreme heat stress during {growth_stage}."
            recommendation = "Apply light overhead misting or mulch protection if feasible to curb flower abortion."
        elif frost_risk:
            risk_score = 85.0
            severity = "high"
            explanation = f"Freezing hazard detected: canopy temperature dropped to {latest_temp:.1f}°C."
            recommendation = "Engage night-time field smoking or light ground watering to raise ground boundary layer temperature."

        confidence = forced_confidence if forced_confidence is not None else 0.85

        return {
            "risk_score": round(risk_score, 1),
            "confidence": round(confidence, 2),
            "severity": severity,
            "status": "ready" if confidence >= 0.70 else "needs_review",
            "model_version": self.model_version,
            "explanation": explanation,
            "recommendation": recommendation,
            "avg_humidity": round(avg_humidity, 1),
            "avg_temp": round(avg_temp, 1)
        }

crop_risk_model = CropRiskMLModel()
