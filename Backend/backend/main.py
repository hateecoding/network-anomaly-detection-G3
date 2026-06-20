from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path
import sys

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent

if str(PARENT_DIR) not in sys.path:
    sys.path.append(str(PARENT_DIR))

from backend.schemas import (
    AlertsResponse,
    DashboardSummaryResponse,
    LiveVisitorsResponse,
    ModelMetricsResponse,
    PredictionResponse,
    TopRoutesResponse,
    TrafficInput,
    UploadAnalysisResponse,
)
from backend.services.predict import (
    ModelLoadingError,
    get_model_artifact_debug_info,
    get_model_metrics_response,
    prediction_history,
    predict_record,
)
from backend.services.upload_analysis import analyze_upload_file, upload_history
from backend.services.visitor_tracker import visitor_tracker


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["*"]


allowed_origins = get_allowed_origins()

app = FastAPI(title="Anomaly Network Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def track_visitor_activity(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception:
        visitor_tracker.record_request(request=request, status_code=500)
        raise

    visitor_tracker.record_request(request=request, status_code=response.status_code)
    return response


def build_error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: object | None = None,
) -> JSONResponse:
    payload: dict[str, object] = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if details is not None:
        payload["error"]["details"] = details

    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(payload),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return build_error_response(
        status_code=exc.status_code,
        code="http_error",
        message=str(exc.detail),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return build_error_response(
        status_code=422,
        code="validation_error",
        message="The request payload is invalid.",
        details=exc.errors(),
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return build_error_response(
        status_code=400,
        code="invalid_input",
        message=str(exc),
    )


@app.exception_handler(ModelLoadingError)
async def model_loading_error_handler(request: Request, exc: ModelLoadingError):
    return build_error_response(
        status_code=503,
        code="model_loading_failed",
        message="Model loading failed",
        details=exc.details,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return build_error_response(
        status_code=500,
        code="internal_error",
        message="The backend could not complete the request.",
    )


@app.get("/")
def root():
    return {
        "message": "API is running",
        "service": "anomaly-network-backend",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug-cors")
def debug_cors():
    try:
        backend_files = sorted(item.name for item in CURRENT_DIR.iterdir())
    except OSError as exc:
        backend_files = [f"Unable to list backend directory: {exc}"]

    return {
        "allowed_origins_env": os.getenv("ALLOWED_ORIGINS"),
        "allowed_origins": allowed_origins,
        "current_working_directory": os.getcwd(),
        "backend_directory": str(CURRENT_DIR),
        "backend_files": backend_files,
    }


@app.get("/debug-models")
def debug_models():
    return get_model_artifact_debug_info()


@app.post("/predict", response_model=PredictionResponse)
def predict(data: TrafficInput):
    response = predict_record(data)
    prediction_history.record(response)
    return response


@app.post("/upload-log", response_model=UploadAnalysisResponse)
async def upload_log(file: UploadFile = File(...)):
    filename = file.filename or "upload.csv"
    contents = await file.read()
    await file.close()

    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return analyze_upload_file(filename=filename, contents=contents)


@app.get("/model-metrics", response_model=ModelMetricsResponse)
def model_metrics():
    return get_model_metrics_response()


@app.get("/dashboard-summary", response_model=DashboardSummaryResponse)
def dashboard_summary():
    upload_summary = upload_history.get_summary()
    live_summary = visitor_tracker.get_live_visitors()

    return DashboardSummaryResponse(
        generated_at=utcnow(),
        total_records=upload_summary["total_records"],
        total_suspicious=upload_summary["total_suspicious"],
        total_normal=upload_summary["total_normal"],
        attack_percentage=upload_summary["attack_percentage"],
        recent_alerts_count=(
            upload_history.get_recent_alert_count()
            + visitor_tracker.get_recent_suspicious_count()
        ),
        active_visitors=live_summary.active_visitors,
        suspicious_visitors=live_summary.suspicious_visitors,
        total_requests_last_5_minutes=live_summary.total_requests_last_5_minutes,
        recent_detections=upload_history.get_recent_detections(limit=20),
        latest_self_test_result=prediction_history.get_latest(),
    )


@app.get("/alerts", response_model=AlertsResponse)
def alerts(limit: int = 25):
    limit = max(1, min(limit, 100))
    items = upload_history.get_recent_alerts(limit=limit)
    items.extend(visitor_tracker.get_suspicious_alerts(limit=limit))
    items.sort(key=lambda item: item.created_at, reverse=True)

    return AlertsResponse(
        generated_at=utcnow(),
        items=items[:limit],
    )


@app.get("/live-visitors", response_model=LiveVisitorsResponse)
def live_visitors(limit: int = 20):
    limit = max(1, min(limit, 100))
    return visitor_tracker.get_live_visitors(limit=limit)


@app.get("/top-routes", response_model=TopRoutesResponse)
def top_routes(limit: int = 10):
    limit = max(1, min(limit, 50))
    return visitor_tracker.get_top_routes(limit=limit)
