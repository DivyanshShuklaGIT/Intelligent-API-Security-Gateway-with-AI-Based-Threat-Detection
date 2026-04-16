# ─── Feature Engineering Module ─────────────────────────────────────
# Transforms raw request metadata into a feature matrix for the
# IsolationForest anomaly detection model.

import numpy as np
from typing import Dict, List


# Feature order expected by the model
FEATURE_NAMES = [
    "request_frequency",
    "payload_size",
    "auth_failures",
    "unique_endpoints",
    "avg_time_between_requests",
]


def extract_features(raw: Dict) -> np.ndarray:
    """
    Convert a raw feature dictionary into a numpy array.
    Missing keys default to 0.
    """
    vector = [
        float(raw.get("requestFrequency", 0)),
        float(raw.get("payloadSize", 0)),
        float(raw.get("authFailures", 0)),
        float(raw.get("uniqueEndpoints", 0)),
        float(raw.get("avgTimeBetweenRequests", 0)),
    ]
    return np.array(vector).reshape(1, -1)


def generate_training_data(n_normal: int = 1000, n_anomalous: int = 50) -> np.ndarray:
    """
    Generate synthetic training data for model bootstrapping.
    Normal traffic has low, regular values.
    Anomalous traffic has high / erratic values.
    """
    rng = np.random.default_rng(42)

    # Normal traffic patterns
    normal = np.column_stack([
        rng.poisson(lam=10, size=n_normal),       # request_frequency (avg ~10/min)
        rng.normal(loc=500, scale=200, size=n_normal).clip(0),  # payload_size
        rng.poisson(lam=0.1, size=n_normal),       # auth_failures (rare)
        rng.poisson(lam=3, size=n_normal),          # unique_endpoints
        rng.exponential(scale=5, size=n_normal),    # avg_time_between_requests (secs)
    ])

    # Anomalous traffic patterns
    anomalous = np.column_stack([
        rng.poisson(lam=100, size=n_anomalous),    # high frequency
        rng.normal(loc=50000, scale=10000, size=n_anomalous).clip(0),  # large payloads
        rng.poisson(lam=8, size=n_anomalous),      # many auth failures
        rng.poisson(lam=40, size=n_anomalous),     # scanning many endpoints
        rng.exponential(scale=0.2, size=n_anomalous),  # very fast requests
    ])

    return np.vstack([normal, anomalous])
