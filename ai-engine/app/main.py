# ─── AI Threat Analysis Engine – FastAPI ────────────────────────────
# Exposes endpoints for the Gateway to analyse requests and check health.

import logging
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional

from .detector import AnomalyDetector
from .features import extract_features

# ── Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-engine")

# ── App & Model ─────────────────────────────────────────────────────
app = FastAPI(
    title="AI Threat Analysis Engine",
    description="ML-powered anomaly detection for the API Security Gateway",
    version="1.0.0",
)

detector = AnomalyDetector(contamination=0.05)
start_time = time.time()


# ── Request / Response Models ───────────────────────────────────────
class AnalyseRequest(BaseModel):
    features: Dict[str, float]


class AnalyseResponse(BaseModel):
    prediction: int
    anomaly_score: float
    risk_score: float
    is_malicious: bool
    riskScore: float  # alias for Gateway compatibility
    isMalicious: bool  # alias for Gateway compatibility


class HealthResponse(BaseModel):
    status: str
    uptime: float
    model_ready: bool
    version: str


# ── Endpoints ───────────────────────────────────────────────────────
@app.post("/analyse", response_model=AnalyseResponse)
async def analyse(request: AnalyseRequest):
    """
    Analyse a request feature vector for anomalous behaviour.
    """
    try:
        features = extract_features(request.features)
        result = detector.predict(features)

        logger.info(
            f"Analysis complete – risk_score={result['risk_score']}, "
            f"malicious={result['is_malicious']}"
        )

        return AnalyseResponse(
            prediction=result["prediction"],
            anomaly_score=result["anomaly_score"],
            risk_score=result["risk_score"],
            riskScore=result["risk_score"],
            is_malicious=result["is_malicious"],
            isMalicious=result["is_malicious"],
        )
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        uptime=round(time.time() - start_time, 2),
        model_ready=detector.model is not None,
        version="1.0.0",
    )


@app.get("/metrics")
async def metrics():
    """Basic metrics endpoint for Prometheus scraping."""
    return {
        "uptime_seconds": round(time.time() - start_time, 2),
        "model_ready": detector.model is not None,
    }
