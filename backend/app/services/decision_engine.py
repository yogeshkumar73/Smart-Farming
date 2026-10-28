"""
M11 — Decision & Safety Engine + M12 Alerts Deduplication
Convert model results into safe, contextual decisions.
Combine prediction, confidence, thresholds and field context.
Safety boundary: model output is a prediction, not automatic authority to perform high-impact actions.
Low-confidence results must not trigger unsafe actions; human override remains required for pump control.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from backend.app.config import settings

class DecisionAndSafetyEngine:
    def evaluate(
        self,
        field: Dict[str, Any],
        irrigation_pred: Dict[str, Any],
        crop_risk_pred: Dict[str, Any],
        existing_alerts: List[Dict[str, Any]],
        forced_confidence: Optional[float] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Evaluates predictions against safety gates and deduplicates alerts.
        Returns: (predictions_to_store, alert_to_create_or_none)
        """
        now_iso = datetime.utcnow().isoformat() + "Z"
        stored_predictions: List[Dict[str, Any]] = []
        new_alert: Optional[Dict[str, Any]] = None

        # 1. Irrigation Evaluation
        irrig_conf = forced_confidence if forced_confidence is not None else irrigation_pred.get("confidence", 0.85)
        irrig_score = irrigation_pred.get("risk_score", 0.0)
        
        irrig_record = {
            "_id": f"pred_{int(datetime.utcnow().timestamp()*1000)}_irrig",
            "field_id": field.get("_id", field.get("id")),
            "timestamp": now_iso,
            "type": "irrigation_need",
            "risk_score": irrig_score,
            "confidence": irrig_conf,
            "severity": irrigation_pred.get("severity", "low"),
            "status": "ready" if irrig_conf >= settings.MIN_CONFIDENCE_THRESHOLD else "needs_review",
            "model_version": irrigation_pred.get("model_version", "v1.2.0"),
            "explanation": irrigation_pred.get("explanation", ""),
            "recommendation": irrigation_pred.get("recommendation", "")
        }
        stored_predictions.append(irrig_record)

        # 2. Safety Interlock Gate: Low confidence must NOT create automated high-severity alerts or automated pump triggers
        if irrig_conf < settings.MIN_CONFIDENCE_THRESHOLD:
            # Low confidence alert - informational advisory only
            irrig_record["severity"] = "low"
            irrig_record["recommendation"] = (
                "[SAFETY GATE APPLIED] Sensor confidence is below 70%. Automatic irrigation is strictly locked out. "
                "Manual visual field inspection required before operating pump."
            )

        # 3. Alert Generation & Deduplication per Section 10
        if irrig_record["severity"] in ["medium", "high"]:
            field_id = field.get("_id", field.get("id"))
            # Check for existing active/acknowledged alert for this field and type
            duplicate = any(
                a.get("field_id") == field_id and
                a.get("type") == "irrigation_need" and
                a.get("status") in ["active", "acknowledged"]
                for a in existing_alerts
            )

            if not duplicate:
                new_alert = {
                    "_id": f"alert_{int(datetime.utcnow().timestamp()*1000)}",
                    "field_id": field_id,
                    "prediction_id": irrig_record["_id"],
                    "type": "irrigation_need",
                    "severity": irrig_record["severity"],
                    "message": f"Critical Moisture Deficit on {field.get('name', 'Field')}",
                    "recommendation": irrig_record["recommendation"],
                    "confidence": irrig_conf,
                    "status": "active",
                    "limitations": "Recommendation requires manual farmer authorization before pump start.",
                    "model_version": irrig_record["model_version"],
                    "created_at": now_iso,
                    "updated_at": now_iso,
                    "occurrence_count": 1
                }

        return stored_predictions, new_alert

decision_engine = DecisionAndSafetyEngine()
