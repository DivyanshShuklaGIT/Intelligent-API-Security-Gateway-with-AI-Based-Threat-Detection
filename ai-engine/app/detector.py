# ─── Anomaly Detector ───────────────────────────────────────────────
# Scikit-Learn IsolationForest wrapped in a class for easy integration.
# Auto-trains on synthetic data at startup, re-trainable via API.

import numpy as np
from sklearn.ensemble import IsolationForest
from .features import generate_training_data, FEATURE_NAMES

import logging

logger = logging.getLogger("ai-engine")


class AnomalyDetector:
    """
    Wraps an IsolationForest model for API request anomaly detection.
    """

    def __init__(self, contamination: float = 0.05):
        self.contamination = contamination
        self.model: IsolationForest | None = None
        self._train_initial()

    def _train_initial(self) -> None:
        """Train on synthetic data so the model is ready immediately."""
        logger.info("Training IsolationForest on synthetic data...")
        data = generate_training_data(n_normal=2000, n_anomalous=100)
        self.model = IsolationForest(
            n_estimators=200,
            contamination=self.contamination,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(data)
        logger.info(
            f"Model trained – {data.shape[0]} samples, "
            f"{len(FEATURE_NAMES)} features"
        )

    def predict(self, features: np.ndarray) -> dict:
        """
        Run inference on a feature vector.
        Returns:
            {
                "prediction": 1 (normal) or -1 (anomaly),
                "anomaly_score": float (0-1, higher = more anomalous),
                "is_malicious": bool,
                "risk_score": float (0-1),
            }
        """
        prediction = self.model.predict(features)[0]
        raw_score = self.model.decision_function(features)[0]

        # Normalise raw_score to 0-1 range (more negative = more anomalous)
        # decision_function returns negative for anomalies, positive for normal
        risk_score = max(0.0, min(1.0, 1.0 - (raw_score + 0.5)))

        return {
            "prediction": int(prediction),
            "anomaly_score": float(-raw_score),
            "risk_score": round(float(risk_score), 4),
            "is_malicious": prediction == -1,
        }

    def retrain(self, data: np.ndarray) -> dict:
        """Retrain the model on new data."""
        self.model = IsolationForest(
            n_estimators=200,
            contamination=self.contamination,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(data)
        return {"status": "retrained", "samples": data.shape[0]}
