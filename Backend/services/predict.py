from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
import json
import logging
import math
import os
import pickle
from pathlib import Path
import tempfile
from threading import Lock
from typing import Any
import warnings

import joblib
import pandas as pd

from schemas import (
    ModelMetricsItem,
    ModelMetricsResponse,
    ModelPerformanceMetrics,
    ModelPredictionResult,
    PredictionResponse,
    TrafficInput,
)
from services.preprocess import get_preprocessing_status, prepare_single_record

BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BASE_DIR.parent
ARTIFACT_DIRS = (
    BASE_DIR,
    BASE_DIR / "anomaly-model-artifacts",
    PROJECT_ROOT / "models",
    PROJECT_ROOT / "outputs" / "final_unified_pipeline" / "models",
)
S3_DOWNLOAD_DIR = Path(tempfile.gettempdir()) / "anomaly-network-model-artifacts"
MODEL_FILENAME_CANDIDATES = {
    "xgboost": ("xgboost.pkl", "best_xgboost_model.pkl"),
    "random_forest": ("random_forest.pkl", "random_forest_model.pkl"),
    "isolation_forest": ("isolation_forest_model.pkl",),
}
MODEL_S3_KEY_ENV_VARS = {
    "xgboost": "XGBOOST_MODEL_S3_KEY",
    "random_forest": "RANDOM_FOREST_MODEL_S3_KEY",
    "isolation_forest": "ISOLATION_FOREST_MODEL_S3_KEY",
}
MODEL_METRICS_FILENAME = "model_metrics.json"
MODEL_ORDER = ("xgboost", "random_forest", "isolation_forest")
DEFAULT_SELECTION_METRIC = "f1"
DEFAULT_BEST_MODEL = "xgboost"
GIT_LFS_POINTER_PREFIX = b"version https://git-lfs.github.com/spec/"

LOGGER = logging.getLogger(__name__)


class ModelLoadingError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        details: str | None = None,
        stage: str = "load_models",
    ):
        super().__init__(message)
        self.details = details or message
        self.stage = stage


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def clamp_probability(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def logistic_probability(value: float) -> float:
    bounded = max(min(float(value), 60.0), -60.0)
    return 1.0 / (1.0 + math.exp(-bounded))


def build_model_prediction_result(
    prediction: int,
    attack_probability: float,
    *,
    score: float | None = None,
) -> ModelPredictionResult:
    result = "attack" if prediction == 1 else "normal"
    probability = clamp_probability(attack_probability)
    confidence = probability if result == "attack" else 1.0 - probability

    return ModelPredictionResult(
        prediction=prediction,
        result=result,
        attack_probability=probability,
        confidence=confidence,
        score=None if score is None else float(score),
    )


def build_model_performance_metrics(
    metrics: dict[str, Any] | None,
) -> ModelPerformanceMetrics | None:
    if not isinstance(metrics, dict):
        return None

    payload = {
        field_name: metrics.get(field_name)
        for field_name in ModelPerformanceMetrics.model_fields
    }

    if not any(value is not None for value in payload.values()):
        return None

    return ModelPerformanceMetrics(**payload)


def build_prediction_response(
    *,
    best_model: str,
    selection_metric: str | None,
    best_model_metrics: ModelPerformanceMetrics | None,
    model_results: dict[str, ModelPredictionResult],
) -> PredictionResponse:
    # The public prediction response exposes the selected model plus per-model results for transparency.
    best_result = model_results[best_model]

    return PredictionResponse(
        prediction=best_result.prediction,
        result=best_result.result,
        detection_result=best_result.result,
        attack_probability=best_result.attack_probability,
        confidence=best_result.confidence,
        timestamp=utcnow(),
        model_used=best_model,
        best_model=best_model,
        selection_metric=selection_metric,
        best_model_metrics=best_model_metrics,
        model_results=model_results,
        preprocessing=get_preprocessing_status(),
    )


def resolve_artifact_path(filename: str) -> Path | None:
    for directory in ARTIFACT_DIRS:
        candidate = directory / filename
        if candidate.exists():
            return candidate

    return None


def get_s3_bucket() -> str | None:
    bucket = os.getenv("MODEL_S3_BUCKET") or os.getenv("S3_MODEL_BUCKET")
    if bucket:
        return bucket.strip() or None

    return None


def get_s3_prefix() -> str:
    prefix = os.getenv("MODEL_S3_PREFIX", "model-artifacts/")
    return prefix.strip().strip("/")


def build_s3_key(filename: str, *, env_var: str | None = None) -> str:
    configured_key = os.getenv(env_var) if env_var else None
    if configured_key:
        return configured_key.strip().lstrip("/")

    prefix = get_s3_prefix()
    return f"{prefix}/{filename}" if prefix else filename


def download_s3_artifact(filename: str, *, env_var: str | None = None) -> Path | None:
    # App Runner downloads artifacts into /tmp; cached model loaders avoid repeat downloads per request.
    bucket = get_s3_bucket()
    if not bucket:
        return None

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as exc:
        raise ModelLoadingError(
            "Model loading failed",
            details="boto3 is not installed, so S3 model artifacts cannot be downloaded.",
        ) from exc

    key = build_s3_key(filename, env_var=env_var)
    local_path = S3_DOWNLOAD_DIR / key
    if local_path.exists() and local_path.stat().st_size > 0:
        return local_path

    local_path.parent.mkdir(parents=True, exist_ok=True)
    LOGGER.info("Downloading model artifact from s3://%s/%s to %s", bucket, key, local_path)

    try:
        boto3.client("s3").download_file(bucket, key, str(local_path))
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code in {"404", "NoSuchKey", "NotFound"} and not os.getenv(env_var or ""):
            LOGGER.warning("S3 model artifact was not found at s3://%s/%s", bucket, key)
            return None
        raise ModelLoadingError(
            "Model loading failed",
            details=f"Unable to download s3://{bucket}/{key}: {exc}",
        ) from exc
    except (BotoCoreError, OSError) as exc:
        raise ModelLoadingError(
            "Model loading failed",
            details=f"Unable to download s3://{bucket}/{key}: {exc}",
        ) from exc

    return local_path


def resolve_model_path(model_name: str) -> Path | None:
    env_var = MODEL_S3_KEY_ENV_VARS[model_name]
    configured_key = os.getenv(env_var)
    if configured_key:
        return download_s3_artifact(Path(configured_key).name, env_var=env_var)

    for filename in MODEL_FILENAME_CANDIDATES[model_name]:
        s3_path = download_s3_artifact(filename, env_var=env_var)
        if s3_path is not None:
            return s3_path

        local_path = resolve_artifact_path(filename)
        if local_path is not None:
            return local_path

    return None


def resolve_metadata_path() -> Path | None:
    s3_path = download_s3_artifact(
        MODEL_METRICS_FILENAME,
        env_var="MODEL_METRICS_S3_KEY",
    )
    if s3_path is not None:
        return s3_path

    return resolve_artifact_path(MODEL_METRICS_FILENAME)


def inspect_s3_artifact(filename: str, *, env_var: str | None = None) -> dict[str, Any]:
    bucket = get_s3_bucket()
    key = build_s3_key(filename, env_var=env_var) if bucket else None
    result: dict[str, Any] = {
        "bucket": bucket,
        "key": key,
        "exists": False,
        "size": None,
        "error": None,
    }
    if not bucket or not key:
        return result

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as exc:
        result["error"] = f"boto3 is not installed: {exc}"
        return result

    try:
        response = boto3.client("s3").head_object(Bucket=bucket, Key=key)
    except ClientError as exc:
        result["error"] = str(exc)
        return result
    except BotoCoreError as exc:
        result["error"] = str(exc)
        return result

    result["exists"] = True
    result["size"] = response.get("ContentLength")
    return result


def inspect_model_artifact(model_name: str, filename: str) -> dict[str, Any]:
    env_var = MODEL_S3_KEY_ENV_VARS[model_name]
    expected_key = build_s3_key(filename, env_var=env_var)
    local_path = resolve_artifact_path(filename)
    s3_info = inspect_s3_artifact(filename, env_var=env_var)
    downloaded_path: Path | None = None
    download_error: str | None = None

    try:
        downloaded_path = download_s3_artifact(filename, env_var=env_var)
    except ModelLoadingError as exc:
        download_error = exc.details

    artifact_path = downloaded_path or local_path
    serializer_checks: dict[str, Any] = {}
    if artifact_path is not None and artifact_path.exists():
        serializer_checks = {
            serializer: summarize_deserialization(artifact_path, serializer)
            for serializer in ("auto", "pickle", "joblib")
        }

    return {
        "model": model_name,
        "filename": filename,
        "expected_s3_key": expected_key,
        "s3": s3_info,
        "download": {
            "success": downloaded_path is not None,
            "path": str(downloaded_path) if downloaded_path else None,
            "error": download_error,
        },
        "local_fallback": {
            "path": str(local_path) if local_path else None,
            "exists": local_path is not None,
            "size": local_path.stat().st_size if local_path else None,
        },
        "serializer_checks": serializer_checks,
    }


def get_model_artifact_debug_info() -> dict[str, Any]:
    expected_artifacts = {
        "xgboost": "xgboost.pkl",
        "random_forest": "random_forest.pkl",
    }

    metadata_path = resolve_artifact_path(MODEL_METRICS_FILENAME)
    return {
        "environment": {
            "MODEL_S3_BUCKET": os.getenv("MODEL_S3_BUCKET"),
            "MODEL_S3_PREFIX": os.getenv("MODEL_S3_PREFIX"),
            "MODEL_SERIALIZER": os.getenv("MODEL_SERIALIZER", "auto"),
        },
        "serializer_order": list(get_serializer_order()),
        "s3_download_dir": str(S3_DOWNLOAD_DIR),
        "expected_s3_keys": {
            model_name: build_s3_key(filename, env_var=MODEL_S3_KEY_ENV_VARS[model_name])
            for model_name, filename in expected_artifacts.items()
        },
        "models": {
            model_name: inspect_model_artifact(model_name, filename)
            for model_name, filename in expected_artifacts.items()
        },
        "metadata": {
            "filename": MODEL_METRICS_FILENAME,
            "local_path": str(metadata_path) if metadata_path else None,
            "local_exists": metadata_path is not None,
            "local_size": metadata_path.stat().st_size if metadata_path else None,
            "s3": inspect_s3_artifact(
                MODEL_METRICS_FILENAME,
                env_var="MODEL_METRICS_S3_KEY",
            ),
        },
        "preprocessing": get_preprocessing_status().model_dump(),
    }


def is_git_lfs_pointer(path: Path) -> bool:
    try:
        with path.open("rb") as file:
            return file.read(len(GIT_LFS_POINTER_PREFIX)).startswith(
                GIT_LFS_POINTER_PREFIX
            )
    except OSError:
        return False


def get_serializer_order() -> tuple[str, ...]:
    serializer = os.getenv("MODEL_SERIALIZER", "auto").strip().lower()
    if serializer == "pickle":
        return ("pickle",)
    if serializer == "joblib":
        return ("joblib",)

    return ("pickle", "joblib")


def attempt_model_deserialization(model_path: Path, serializer: str) -> dict[str, Any]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            if serializer == "pickle":
                with model_path.open("rb") as file:
                    model = pickle.load(file)
            elif serializer == "joblib":
                model = joblib.load(model_path)
            else:
                return {
                    "success": False,
                    "serializer": serializer,
                    "model": None,
                    "model_type": None,
                    "error": f"Unsupported serializer: {serializer}",
                }
    except Exception as exc:
        return {
            "success": False,
            "serializer": serializer,
            "model": None,
            "model_type": None,
            "error": f"{type(exc).__name__}: {exc}",
        }

    return {
        "success": True,
        "serializer": serializer,
        "model": model,
        "model_type": f"{type(model).__module__}.{type(model).__name__}",
        "error": None,
    }


def summarize_deserialization(model_path: Path, serializer: str) -> dict[str, Any]:
    if serializer == "auto":
        attempts = [
            summarize_deserialization(model_path, candidate)
            for candidate in get_serializer_order()
        ]
        successful = next((attempt for attempt in attempts if attempt["success"]), None)
        return {
            "success": successful is not None,
            "serializer": "auto",
            "selected_serializer": successful["serializer"] if successful else None,
            "model_type": successful["model_type"] if successful else None,
            "attempts": attempts,
            "error": None if successful else "No serializer could load this artifact.",
        }

    result = attempt_model_deserialization(model_path, serializer)
    return {
        "success": result["success"],
        "serializer": serializer,
        "selected_serializer": serializer if result["success"] else None,
        "model_type": result["model_type"],
        "error": result["error"],
    }


def deserialize_model(model_name: str, model_path: Path) -> Any:
    # Support pickle/joblib because historical notebooks may have serialized models with either library.
    file_size = model_path.stat().st_size
    errors: list[str] = []

    LOGGER.info(
        "Loading %s model from %s (%s bytes)",
        model_name,
        model_path,
        file_size,
    )
    print(
        f"MODEL_LOAD_START model={model_name} path={model_path} size={file_size}",
        flush=True,
    )

    for serializer in get_serializer_order():
        LOGGER.info("Attempting %s deserialization for %s", serializer, model_path)
        print(
            f"MODEL_LOAD_SERIALIZER_ATTEMPT model={model_name} serializer={serializer}",
            flush=True,
        )
        result = attempt_model_deserialization(model_path, serializer)
        if not result["success"]:
            error_message = str(result["error"])
            errors.append(f"{serializer}: {error_message}")
            LOGGER.warning(
                "Unable to deserialize %s model from %s with %s: %s",
                model_name,
                model_path,
                serializer,
                error_message,
            )
            continue

        LOGGER.info(
            "Successfully loaded %s model from %s using %s",
            model_name,
            model_path,
            serializer,
        )
        print(
            f"MODEL_LOAD_SUCCESS model={model_name} serializer={serializer}",
            flush=True,
        )
        return result["model"]

    raise ModelLoadingError(
        "Model loading failed",
        details=f"Unable to deserialize {model_path.name}. Attempts: {'; '.join(errors)}",
    )


@lru_cache(maxsize=1)
def load_models() -> dict[str, Any]:
    # Load all available models once; optional artifacts are skipped with diagnostics instead of breaking startup.
    models: dict[str, Any] = {}
    load_errors: list[str] = []

    for model_name in MODEL_ORDER:
        try:
            model_path = resolve_model_path(model_name)
        except ModelLoadingError as exc:
            load_errors.append(f"{model_name}: {exc.details}")
            continue

        if model_path is not None:
            if is_git_lfs_pointer(model_path):
                message = (
                    f"Skipping {model_name} model because {model_path} is a Git LFS "
                    "pointer, not a binary artifact."
                )
                LOGGER.warning(message)
                load_errors.append(message)
                continue

            try:
                models[model_name] = deserialize_model(model_name, model_path)
            except ModelLoadingError as exc:
                load_errors.append(exc.details)
                continue

    if not models:
        detail = (
            "No model artifacts were loaded. Configure MODEL_S3_BUCKET and MODEL_S3_PREFIX, "
            "or provide local artifacts in backend/anomaly-model-artifacts."
        )
        if load_errors:
            detail = f"{detail} Errors: {' | '.join(load_errors)}"
        raise ModelLoadingError("Model loading failed", details=detail)

    print(
        f"MODEL_LOADING_RESULT loaded_models={','.join(models.keys())}",
        flush=True,
    )
    return models


@lru_cache(maxsize=1)
def load_model_metadata() -> dict[str, Any]:
    model_metrics_path = resolve_metadata_path()
    if model_metrics_path is None:
        return {
            "selection_metric": DEFAULT_SELECTION_METRIC,
            "best_model": DEFAULT_BEST_MODEL,
            "models": {},
        }

    try:
        with model_metrics_path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {
            "selection_metric": DEFAULT_SELECTION_METRIC,
            "best_model": DEFAULT_BEST_MODEL,
            "models": {},
        }

    if not isinstance(payload, dict):
        return {
            "selection_metric": DEFAULT_SELECTION_METRIC,
            "best_model": DEFAULT_BEST_MODEL,
            "models": {},
        }

    return payload


def get_available_model_names() -> list[str]:
    loaded_models = load_models()
    return [model_name for model_name in MODEL_ORDER if model_name in loaded_models]


def _extract_metric_value(metrics: dict[str, Any] | None, metric_name: str | None) -> float | None:
    if not metric_name or not isinstance(metrics, dict):
        return None

    value = metrics.get(metric_name)
    if isinstance(value, (int, float)):
        return float(value)

    return None


def resolve_best_model_name(
    available_models: list[str],
) -> tuple[str, str | None, ModelPerformanceMetrics | None]:
    # Model metadata drives recommendation; XGBoost is only the fallback when metrics are unavailable.
    if not available_models:
        raise ValueError("No loaded models are available for prediction.")

    metadata = load_model_metadata()
    selection_metric = metadata.get("selection_metric")
    selection_metric = (
        selection_metric if isinstance(selection_metric, str) else DEFAULT_SELECTION_METRIC
    )
    metadata_models = metadata.get("models") if isinstance(metadata.get("models"), dict) else {}

    ranked_models: list[tuple[float, int, str]] = []
    for model_name in available_models:
        metric_value = _extract_metric_value(metadata_models.get(model_name), selection_metric)
        if metric_value is None:
            continue
        ranked_models.append((metric_value, -MODEL_ORDER.index(model_name), model_name))

    if ranked_models:
        ranked_models.sort(reverse=True)
        best_model = ranked_models[0][2]
    else:
        configured_best = metadata.get("best_model")
        if isinstance(configured_best, str) and configured_best in available_models:
            best_model = configured_best
        elif DEFAULT_BEST_MODEL in available_models:
            best_model = DEFAULT_BEST_MODEL
        else:
            best_model = available_models[0]

    best_metrics = build_model_performance_metrics(metadata_models.get(best_model))
    return best_model, selection_metric, best_metrics


def predict_with_model(
    model_name: str,
    model: Any,
    processed_df: pd.DataFrame,
) -> list[ModelPredictionResult]:
    # Probability output is preferred; Isolation Forest uses anomaly scores converted to a bounded probability.
    model_input = processed_df.to_numpy()
    raw_predictions = list(model.predict(model_input))

    if hasattr(model, "predict_proba"):
        probabilities = [
            clamp_probability(probability_row[1])
            for probability_row in model.predict_proba(model_input)
        ]
        predictions = [int(value) for value in raw_predictions]
        scores: list[float | None] = [None] * len(predictions)
    elif model_name == "isolation_forest" and hasattr(model, "decision_function"):
        anomaly_scores = [-float(value) for value in model.decision_function(model_input)]
        probabilities = [logistic_probability(score) for score in anomaly_scores]
        predictions = [1 if int(value) == -1 else 0 for value in raw_predictions]
        scores = anomaly_scores
    else:
        predictions = [int(value) for value in raw_predictions]
        probabilities = [1.0 if prediction == 1 else 0.0 for prediction in predictions]
        scores = [None] * len(predictions)

    return [
        build_model_prediction_result(
            prediction,
            attack_probability,
            score=score,
        )
        for prediction, attack_probability, score in zip(predictions, probabilities, scores)
    ]


def predict_processed_frame(processed_df: pd.DataFrame) -> dict[str, Any]:
    # Batch prediction runs every loaded model on the already aligned 67-feature dataframe.
    loaded_models = load_models()
    available_models = [model_name for model_name in MODEL_ORDER if model_name in loaded_models]
    print(
        f"PREDICTION_MODEL_INPUT rows={processed_df.shape[0]} features={processed_df.shape[1]} available_models={','.join(available_models)}",
        flush=True,
    )
    best_model, selection_metric, best_model_metrics = resolve_best_model_name(
        available_models
    )

    model_results = {
        model_name: predict_with_model(model_name, loaded_models[model_name], processed_df)
        for model_name in available_models
    }

    return {
        "best_model": best_model,
        "selection_metric": selection_metric,
        "best_model_metrics": best_model_metrics,
        "model_results": model_results,
    }


def predict_record(data: TrafficInput) -> PredictionResponse:
    processed_df, _ = prepare_single_record(data)
    batch_prediction = predict_processed_frame(processed_df)
    record_results = {
        model_name: predictions[0]
        for model_name, predictions in batch_prediction["model_results"].items()
    }

    return build_prediction_response(
        best_model=batch_prediction["best_model"],
        selection_metric=batch_prediction["selection_metric"],
        best_model_metrics=batch_prediction["best_model_metrics"],
        model_results=record_results,
    )


def get_model_metrics_response() -> ModelMetricsResponse:
    available_models = get_available_model_names()
    best_model, selection_metric, _ = resolve_best_model_name(available_models)
    metadata = load_model_metadata()
    metadata_models = (
        metadata.get("models") if isinstance(metadata.get("models"), dict) else {}
    )

    items = [
        ModelMetricsItem(
            model_name=model_name,
            recommended=model_name == best_model,
            metrics=build_model_performance_metrics(metadata_models.get(model_name)),
        )
        for model_name in available_models
    ]

    return ModelMetricsResponse(
        generated_at=utcnow(),
        selection_metric=selection_metric,
        recommended_model=best_model,
        items=items,
    )


class PredictionHistoryStore:
    def __init__(self):
        self._latest_prediction: PredictionResponse | None = None
        self._lock = Lock()

    def record(self, prediction: PredictionResponse) -> None:
        with self._lock:
            self._latest_prediction = prediction

    def get_latest(self) -> PredictionResponse | None:
        with self._lock:
            return self._latest_prediction


prediction_history = PredictionHistoryStore()
