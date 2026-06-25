from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path
import sys
import traceback

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent

if str(PARENT_DIR) not in sys.path:
    sys.path.append(str(PARENT_DIR))

from schemas import (
    AlertsResponse,
    DashboardSummaryResponse,
    LiveVisitorsResponse,
    ModelMetricsResponse,
    PredictionResponse,
    TrackVisitInput,
    TopRoutesResponse,
    TrafficInput,
    UploadAnalysisResponse,
)
from services.predict import (
    ModelLoadingError,
    get_model_artifact_debug_info,
    get_model_metrics_response,
    prediction_history,
    predict_record,
)
from services.upload_analysis import analyze_upload_file, upload_history, validate_upload_size
from services.visitor_tracker import visitor_tracker


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["*"]


allowed_origins = get_allowed_origins()

app = FastAPI(title="Anomaly Network Backend", version="1.0.0")


def debug_endpoints_enabled() -> bool:
    return os.getenv("ENABLE_DEBUG_ENDPOINTS", "false").strip().lower() in {
        "1",
        "true",
        "yes",
    }

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
    stage: str | None = None,
) -> JSONResponse:
    payload: dict[str, object] = {
        "error": code,
        "message": message,
        "detail": details if details is not None else message,
        "error_info": {
            "code": code,
            "message": message,
        }
    }
    if stage is not None:
        payload["stage"] = stage
    if details is not None:
        payload["details"] = details

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
        message="The prediction model is temporarily unavailable.",
        details=exc.details if debug_endpoints_enabled() else None,
        stage=exc.stage,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    print(
        f"UNHANDLED_BACKEND_ERROR path={request.url.path} error={type(exc).__name__}: {exc}",
        flush=True,
    )
    traceback.print_exc()
    return build_error_response(
        status_code=500,
        code="internal_error",
        message="The backend could not complete the request.",
        details=(
            f"{type(exc).__name__}: {exc}"
            if debug_endpoints_enabled()
            else None
        ),
        stage="unhandled",
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
    if not debug_endpoints_enabled():
        raise HTTPException(status_code=404, detail="Debug endpoint is disabled.")

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
    if not debug_endpoints_enabled():
        raise HTTPException(status_code=404, detail="Debug endpoint is disabled.")

    return get_model_artifact_debug_info()


@app.post("/predict", response_model=PredictionResponse)
def predict(data: TrafficInput):
    response = predict_record(data)
    prediction_history.record(response)
    return response


@app.post("/upload-log", response_model=UploadAnalysisResponse)
async def upload_log(file: UploadFile = File(...)):
    filename = file.filename or "upload.csv"
    print("UPLOAD_LOG_ENDPOINT_HIT", flush=True)
    print(f"UPLOAD_LOG_FILENAME filename={filename}", flush=True)

    try:
        contents = await file.read()
    except Exception as exc:
        print(f"UPLOAD_LOG_READ_FAILED error={type(exc).__name__}: {exc}", flush=True)
        return build_error_response(
            status_code=400,
            code="upload_read_failed",
            message="Uploaded file could not be read.",
            details=(
                f"{type(exc).__name__}: {exc}"
                if debug_endpoints_enabled()
                else None
            ),
            stage="read_upload",
        )
    finally:
        await file.close()

    try:
        validate_upload_size(contents)
    except ValueError as exc:
        return build_error_response(
            status_code=400,
            code="invalid_upload",
            message=str(exc),
            details=str(exc),
            stage="read_upload",
        )

    try:
        return analyze_upload_file(filename=filename, contents=contents)
    except ModelLoadingError as exc:
        print(f"UPLOAD_LOG_MODEL_LOADING_FAILED detail={exc.details}", flush=True)
        return build_error_response(
            status_code=503,
            code="model_loading_failed",
            message="The prediction model is temporarily unavailable.",
            details=exc.details if debug_endpoints_enabled() else None,
            stage=exc.stage,
        )
    except ValueError as exc:
        print(f"UPLOAD_LOG_VALIDATION_FAILED detail={exc}", flush=True)
        return build_error_response(
            status_code=400,
            code="upload_analysis_failed",
            message="Upload analysis failed.",
            details=str(exc),
            stage="preprocess_upload",
        )
    except Exception as exc:
        print(
            f"UPLOAD_LOG_UNEXPECTED_FAILED error={type(exc).__name__}: {exc}",
            flush=True,
        )
        traceback.print_exc()
        return build_error_response(
            status_code=500,
            code="upload_analysis_failed",
            message="Upload analysis failed.",
            details=(
                f"{type(exc).__name__}: {exc}"
                if debug_endpoints_enabled()
                else None
            ),
            stage="upload_log",
        )


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
        total_review_recommended=upload_summary["total_review_recommended"],
        total_attacks=upload_summary["total_attacks"],
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


@app.post("/track-visit")
def track_visit(payload: TrackVisitInput, request: Request):
    visitor_tracker.record_frontend_visit(request=request, route=payload.route)
    return {
        "status": "recorded",
        "route": payload.route,
        "recorded_at": utcnow(),
    }


@app.get("/top-routes", response_model=TopRoutesResponse)
def top_routes(limit: int = 10):
    limit = max(1, min(limit, 50))
    return visitor_tracker.get_top_routes(limit=limit)
