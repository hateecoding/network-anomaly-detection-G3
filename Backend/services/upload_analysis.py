from __future__ import annotations

from collections import Counter, deque
from datetime import datetime, timezone
import io
import json
from pathlib import Path
from threading import Lock

import pandas as pd

from schemas import (
    AlertRecord,
    ConfidenceBucket,
    ConfusionMatrix,
    RecentDetectionPoint,
    UploadAnalysisResponse,
    UploadChartData,
    UploadChartItem,
    UploadModelAnalysis,
    UploadModelAnalysisItem,
    UploadModelBreakdown,
    ProtocolRiskItem,
    UploadRecordResult,
    UploadSummary,
    UploadTrendPoint,
)
from services.classification import (
    ATTACK_THRESHOLD,
    REVIEW_THRESHOLD,
    get_display_category,
)
from services.predict import predict_processed_frame
from services.preprocess import (
    apply_known_headerless_schema,
    get_feature_columns,
    prepare_batch_input,
)

ALLOWED_EXTENSIONS = {".csv", ".json"}
MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024
MAX_UPLOAD_ROWS = 250_000
MAX_RETURNED_RECORDS = 1_000
TREND_BUCKET_COUNT = 12
NORMAL_LABELS = {"normal", "benign", "0", "none", "unknown", "-", "no", "false"}
ATTACK_LABELS = {"attack", "malicious", "anomaly", "1", "yes", "true"}
GROUND_TRUTH_NORMAL_LABELS = {"normal", "benign", "0", "no", "false"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _read_csv(contents: bytes, *, header: int | None = 0) -> pd.DataFrame:
    for encoding in (None, "latin1"):
        try:
            buffer = io.BytesIO(contents)
            if encoding is None:
                return pd.read_csv(buffer, header=header)
            return pd.read_csv(buffer, encoding=encoding, header=header)
        except UnicodeDecodeError:
            continue
        except Exception as exc:
            raise ValueError("Unable to parse the uploaded CSV file.") from exc

    raise ValueError("Unable to parse the uploaded CSV file.")


def _read_json(contents: bytes) -> pd.DataFrame:
    try:
        payload = json.loads(contents.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Unable to parse the uploaded JSON file.") from exc

    records: list[dict] | list | None
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        if isinstance(payload.get("records"), list):
            records = payload["records"]
        elif isinstance(payload.get("data"), list):
            records = payload["data"]
        else:
            records = [payload]
    else:
        raise ValueError("JSON uploads must be an object or an array of objects.")

    frame = pd.DataFrame(records)
    if frame.empty:
        raise ValueError("Uploaded JSON is empty.")

    return frame


def _read_upload(filename: str, contents: bytes, *, header: int | None = 0) -> pd.DataFrame:
    suffix = Path(filename).suffix.lower()
    if suffix == ".json":
        return _read_json(contents)
    return _read_csv(contents, header=header)


def _clean_optional_text(value) -> str | None:
    if pd.isna(value):
        return None

    text = str(value).strip()
    return text or None


def _build_alert_level(result: str, attack_probability: float) -> str:
    if result != "attack":
        return "low"
    if attack_probability >= 0.9:
        return "high"
    if attack_probability >= 0.7:
        return "medium"
    return "low"


def _probability_bucket_label(attack_probability: float) -> str:
    if attack_probability <= 0.2:
        return "0-20%"
    if attack_probability <= 0.4:
        return "21-40%"
    if attack_probability <= 0.6:
        return "41-60%"
    if attack_probability <= 0.8:
        return "61-80%"
    return "81-100%"


def _normalize_protocol(value) -> str:
    text = (_clean_optional_text(value) or "OTHER").upper()
    if "TCP" in text:
        return "TCP"
    if "UDP" in text:
        return "UDP"
    if "ICMP" in text:
        return "ICMP"
    return "OTHER"


def _summarize_model_predictions(results) -> UploadModelBreakdown:
    attack_records = sum(1 for item in results if item.result == "attack")
    total_records = len(results)
    normal_records = total_records - attack_records
    attack_percentage = (
        round((attack_records / total_records) * 100, 2) if total_records else 0.0
    )

    return UploadModelBreakdown(
        attack_records=attack_records,
        normal_records=normal_records,
        attack_percentage=attack_percentage,
    )


def _validate_filename(filename: str) -> None:
    lowered = filename.lower()
    if not any(lowered.endswith(extension) for extension in ALLOWED_EXTENSIONS):
        raise ValueError("Only CSV and JSON uploads are supported right now.")


def validate_upload_size(contents: bytes) -> None:
    if not contents:
        raise ValueError("Uploaded file is empty.")
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise ValueError("Uploaded file is too large. Please upload a file under 25 MB.")


def _normalize_truth_label(value) -> int | None:
    text = _clean_optional_text(value)
    if text is None:
        return None

    normalized = text.strip().lower()
    if normalized in {"none", "unknown", "-"}:
        return None
    if normalized in GROUND_TRUTH_NORMAL_LABELS:
        return 0
    if normalized in ATTACK_LABELS:
        return 1

    numeric_value = pd.to_numeric(pd.Series([text]), errors="coerce").iloc[0]
    if pd.notna(numeric_value):
        return 1 if float(numeric_value) > 0 else 0

    return 1


def _extract_truth_labels(context_df: pd.DataFrame) -> list[int] | None:
    candidates: list[int | None] = []
    for _, row in context_df.iterrows():
        label = _normalize_truth_label(row.get("label"))
        if label is None:
            label = _normalize_truth_label(row.get("attack_name"))
        candidates.append(label)

    if not candidates or any(value is None for value in candidates):
        return None

    return [int(value) for value in candidates if value is not None]


def _safe_ratio(numerator: int | float, denominator: int | float) -> float | None:
    if denominator == 0:
        return None
    return round(float(numerator) / float(denominator), 4)


def _calculate_roc_auc(truth: list[int], scores: list[float]) -> float | None:
    positives = sum(1 for value in truth if value == 1)
    negatives = len(truth) - positives
    if positives == 0 or negatives == 0:
        return None

    indexed_scores = sorted(enumerate(scores), key=lambda item: item[1])
    ranks = [0.0] * len(scores)
    index = 0
    while index < len(indexed_scores):
        tie_end = index
        while (
            tie_end + 1 < len(indexed_scores)
            and indexed_scores[tie_end + 1][1] == indexed_scores[index][1]
        ):
            tie_end += 1
        average_rank = (index + 1 + tie_end + 1) / 2
        for rank_index in range(index, tie_end + 1):
            original_index = indexed_scores[rank_index][0]
            ranks[original_index] = average_rank
        index = tie_end + 1

    positive_rank_sum = sum(rank for rank, label in zip(ranks, truth) if label == 1)
    auc = (positive_rank_sum - positives * (positives + 1) / 2) / (positives * negatives)
    return round(float(auc), 4)


def _confidence_buckets(results) -> list[ConfidenceBucket]:
    bucket_defs = [
        ("0-20%", 0.0, 0.2),
        ("21-40%", 0.2000001, 0.4),
        ("41-60%", 0.4000001, 0.6),
        ("61-80%", 0.6000001, 0.8),
        ("81-100%", 0.8000001, 1.0),
    ]
    counts = {label: 0 for label, _, _ in bucket_defs}

    for result in results:
        confidence = float(result.confidence)
        for label, lower, upper in bucket_defs:
            if lower <= confidence <= upper:
                counts[label] += 1
                break

    return [ConfidenceBucket(label=label, count=count) for label, count in counts.items()]


def _build_model_analysis(
    *,
    model_results,
    context_df: pd.DataFrame,
    fallback_best_model: str,
) -> UploadModelAnalysis:
    truth = _extract_truth_labels(context_df)
    labels_available = truth is not None
    models: list[UploadModelAnalysisItem] = []

    for model_name, results in model_results.items():
        predictions = [1 if result.result == "attack" else 0 for result in results]
        attack_predictions = sum(predictions)
        normal_predictions = len(predictions) - attack_predictions
        confidence_values = [float(result.confidence) for result in results]

        metrics: dict[str, float | None] = {
            "accuracy": None,
            "precision": None,
            "recall": None,
            "f1": None,
            "roc_auc": None,
        }
        confusion_matrix: ConfusionMatrix | None = None

        if labels_available and truth is not None:
            tp = sum(1 for actual, predicted in zip(truth, predictions) if actual == 1 and predicted == 1)
            tn = sum(1 for actual, predicted in zip(truth, predictions) if actual == 0 and predicted == 0)
            fp = sum(1 for actual, predicted in zip(truth, predictions) if actual == 0 and predicted == 1)
            fn = sum(1 for actual, predicted in zip(truth, predictions) if actual == 1 and predicted == 0)
            precision = _safe_ratio(tp, tp + fp)
            recall = _safe_ratio(tp, tp + fn)
            f1 = (
                round((2 * precision * recall) / (precision + recall), 4)
                if precision is not None and recall is not None and precision + recall > 0
                else None
            )
            metrics = {
                "accuracy": _safe_ratio(tp + tn, len(truth)),
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "roc_auc": _calculate_roc_auc(
                    truth,
                    [float(result.attack_probability) for result in results],
                ),
            }
            confusion_matrix = ConfusionMatrix(
                true_negative=tn,
                false_positive=fp,
                false_negative=fn,
                true_positive=tp,
            )

        models.append(
            UploadModelAnalysisItem(
                model_name=model_name,
                accuracy=metrics["accuracy"],
                precision=metrics["precision"],
                recall=metrics["recall"],
                f1=metrics["f1"],
                roc_auc=metrics["roc_auc"],
                normal_predictions=normal_predictions,
                attack_predictions=attack_predictions,
                average_confidence=(
                    round(sum(confidence_values) / len(confidence_values), 4)
                    if confidence_values
                    else None
                ),
                confidence_buckets=_confidence_buckets(results),
                confusion_matrix=confusion_matrix,
            )
        )

    best_model = fallback_best_model
    highest_recall_model: str | None = None
    highest_f1_model: str | None = None
    if labels_available:
        ranked_by_f1 = [
            item for item in models if item.f1 is not None
        ]
        ranked_by_recall = [
            item for item in models if item.recall is not None
        ]
        if ranked_by_f1:
            ranked_by_f1.sort(key=lambda item: (item.f1 or 0, item.recall or 0), reverse=True)
            best_model = ranked_by_f1[0].model_name
            highest_f1_model = ranked_by_f1[0].model_name
        if ranked_by_recall:
            ranked_by_recall.sort(key=lambda item: (item.recall or 0, item.f1 or 0), reverse=True)
            highest_recall_model = ranked_by_recall[0].model_name

    return UploadModelAnalysis(
        labels_available=labels_available,
        evaluated_records=len(context_df),
        best_model=best_model,
        highest_recall_model=highest_recall_model,
        highest_f1_model=highest_f1_model,
        models=models,
    )


def analyze_upload_file(filename: str, contents: bytes) -> UploadAnalysisResponse:
    print(f"UPLOAD_LOG_ANALYSIS_START filename={filename}", flush=True)
    _validate_filename(filename)
    raw_df = _read_upload(filename, contents)
    print(
        f"UPLOAD_LOG_CSV_SHAPE rows={raw_df.shape[0]} columns={raw_df.shape[1]}",
        flush=True,
    )

    if raw_df.empty:
        raise ValueError("Uploaded file is empty.")
    if len(raw_df) > MAX_UPLOAD_ROWS:
        raise ValueError(
            f"Uploaded dataset is too large. Please upload {MAX_UPLOAD_ROWS:,} rows or fewer."
        )

    try:
        processed_df, context_df = prepare_batch_input(raw_df)
    except ValueError as exc:
        suffix = Path(filename).suffix.lower()
        if suffix == ".json":
            raise

        headerless_df = _read_upload(filename, contents, header=None)
        if headerless_df.empty:
            raise ValueError("Uploaded file is empty.") from exc
        if len(headerless_df) > MAX_UPLOAD_ROWS:
            raise ValueError(
                f"Uploaded dataset is too large. Please upload {MAX_UPLOAD_ROWS:,} rows or fewer."
            ) from exc

        try:
            structured_df = apply_known_headerless_schema(headerless_df)
            processed_df, context_df = prepare_batch_input(structured_df)
        except ValueError:
            raise exc

    expected_feature_count = len(get_feature_columns())
    print(
        f"UPLOAD_LOG_FEATURES expected={expected_feature_count} selected={processed_df.shape[1]} rows={processed_df.shape[0]}",
        flush=True,
    )
    print("UPLOAD_LOG_MODEL_LOADING_START", flush=True)
    batch_prediction = predict_processed_frame(processed_df)
    print(
        f"UPLOAD_LOG_MODEL_LOADING_DONE best_model={batch_prediction['best_model']} models={','.join(batch_prediction['model_results'].keys())}",
        flush=True,
    )
    best_model = batch_prediction["best_model"]
    selection_metric = batch_prediction["selection_metric"]
    best_model_metrics = batch_prediction["best_model_metrics"]
    model_results = batch_prediction["model_results"]
    best_model_results = model_results[best_model]
    generated_at = utcnow()

    total_records = len(best_model_results)
    records: list[UploadRecordResult] = []
    review_recommended_rows: list[UploadRecordResult] = []
    alerts: list[AlertRecord] = []
    display_counts: Counter[str] = Counter()
    protocol_category_counts: dict[str, Counter[str]] = {}
    flagged_source_counts: Counter[str] = Counter()
    confidence_counts: Counter[str] = Counter()
    trend_bucket_size = max(1, (total_records + TREND_BUCKET_COUNT - 1) // TREND_BUCKET_COUNT)
    trend_counts = [
        {
            "normal": 0,
            "review_recommended": 0,
            "attack": 0,
            "probability_sum": 0.0,
            "maximum_attack_probability": 0.0,
            "protocols": Counter(),
        }
        for _ in range(min(TREND_BUCKET_COUNT, total_records))
    ]

    for position, best_result in enumerate(best_model_results, start=1):
        row_label = context_df.index[position - 1]
        alert_level = _build_alert_level(
            best_result.result,
            best_result.attack_probability,
        )
        row_model_results = {
            model_name: results[position - 1]
            for model_name, results in model_results.items()
        }

        source_ip = _clean_optional_text(context_df.at[row_label, "source_ip"])
        destination_ip = _clean_optional_text(context_df.at[row_label, "destination_ip"])
        route = _clean_optional_text(context_df.at[row_label, "route"])
        protocol = _clean_optional_text(context_df.at[row_label, "protocol"])
        service = _clean_optional_text(context_df.at[row_label, "service"])
        duration = float(context_df.at[row_label, "duration"])
        category = get_display_category(
            best_result.result,
            float(best_result.attack_probability),
        )
        display_counts[category] += 1
        normalized_protocol = _normalize_protocol(protocol)
        protocol_category_counts.setdefault(normalized_protocol, Counter())[category] += 1
        confidence_counts[_probability_bucket_label(float(best_result.attack_probability))] += 1
        bucket_index = min((position - 1) // trend_bucket_size, len(trend_counts) - 1)
        trend_counts[bucket_index][category] += 1
        trend_counts[bucket_index]["probability_sum"] += float(best_result.attack_probability)
        trend_counts[bucket_index]["maximum_attack_probability"] = max(
            float(trend_counts[bucket_index]["maximum_attack_probability"]),
            float(best_result.attack_probability),
        )
        trend_counts[bucket_index]["protocols"][normalized_protocol] += 1
        if category != "normal" and source_ip is not None:
            flagged_source_counts[source_ip] += 1

        record = UploadRecordResult(
            row_id=position,
            source_ip=source_ip,
            destination_ip=destination_ip,
            protocol=protocol,
            service=service,
            duration=duration,
            src_bytes=float(context_df.at[row_label, "src_bytes"]),
            dst_bytes=float(context_df.at[row_label, "dst_bytes"]),
            total_bytes=float(context_df.at[row_label, "total_bytes"]),
            byte_ratio=float(context_df.at[row_label, "byte_ratio"]),
            activity_count=float(context_df.at[row_label, "activity_count"]),
            service_count=float(context_df.at[row_label, "service_count"]),
            same_service_rate=float(context_df.at[row_label, "same_service_rate"]),
            destination_host_count=float(context_df.at[row_label, "destination_host_count"]),
            destination_host_service_count=float(
                context_df.at[row_label, "destination_host_service_count"]
            ),
            prediction=best_result.prediction,
            model_prediction=best_result.result,
            display_category=category,
            result=best_result.result,
            detection_result=best_result.result,
            attack_probability=best_result.attack_probability,
            confidence=best_result.confidence,
            alert_level=alert_level,
            model_results=row_model_results,
        )
        if len(records) < MAX_RETURNED_RECORDS:
            records.append(record)

        if category == "review_recommended" and len(review_recommended_rows) < 100:
            review_recommended_rows.append(record)

        if best_result.result == "attack":
            if len(alerts) < 50:
                alerts.append(
                    AlertRecord(
                        alert_type="upload",
                        created_at=generated_at,
                        message=f"Upload row {position} flagged for review by {best_model}.",
                        alert_level=alert_level,
                        source_ip=source_ip,
                        destination_ip=destination_ip,
                        route=route,
                        row_id=position,
                        prediction=best_result.prediction,
                        result=best_result.result,
                        confidence=best_result.confidence,
                        attack_probability=best_result.attack_probability,
                    )
                )

    normal_count = display_counts["normal"]
    review_count = display_counts["review_recommended"]
    attack_count = display_counts["attack"]
    attack_percentage = (
        round((attack_count / total_records) * 100, 2) if total_records else 0.0
    )
    print(
        f"UPLOAD_LOG_PREDICTION_SUMMARY total={total_records} normal={normal_count} "
        f"review_recommended={review_count} attack={attack_count} "
        f"attack_percentage={attack_percentage}",
        flush=True,
    )

    response = UploadAnalysisResponse(
        generated_at=generated_at,
        filename=filename,
        summary=UploadSummary(
            total_records=total_records,
            review_recommended_records=review_count,
            review_recommended_rows=review_count,
            normal_records=normal_count,
            normal_count=normal_count,
            attack_count=attack_count,
            attack_percentage=attack_percentage,
            model_used=best_model,
            best_model=best_model,
            selection_metric=selection_metric,
            best_model_metrics=best_model_metrics,
            model_summaries={
                model_name: _summarize_model_predictions(results)
                for model_name, results in model_results.items()
            },
        ),
        total_records=total_records,
        returned_records=len(records),
        records_truncated=total_records > len(records),
        max_returned_records=MAX_RETURNED_RECORDS,
        review_threshold=REVIEW_THRESHOLD,
        attack_threshold=ATTACK_THRESHOLD,
        chart_data=UploadChartData(
            trend=[
                UploadTrendPoint(
                    label=(
                        f"{index * trend_bucket_size + 1}-"
                        f"{min((index + 1) * trend_bucket_size, total_records)}"
                    ),
                    start_row=index * trend_bucket_size + 1,
                    end_row=min((index + 1) * trend_bucket_size, total_records),
                    total_records=(
                        counts["normal"]
                        + counts["review_recommended"]
                        + counts["attack"]
                    ),
                    average_attack_probability=round(
                        float(counts["probability_sum"])
                        / max(
                            1,
                            counts["normal"]
                            + counts["review_recommended"]
                            + counts["attack"],
                        ),
                        4,
                    ),
                    maximum_attack_probability=round(
                        float(counts["maximum_attack_probability"]),
                        4,
                    ),
                    normal=counts["normal"],
                    review_recommended=counts["review_recommended"],
                    attack=counts["attack"],
                    most_common_protocol=(
                        counts["protocols"].most_common(1)[0][0]
                        if counts["protocols"]
                        else None
                    ),
                )
                for index, counts in enumerate(trend_counts)
            ],
            protocol_risk=[
                ProtocolRiskItem(
                    protocol=protocol,
                    total_records=sum(protocol_category_counts[protocol].values()),
                    normal=protocol_category_counts[protocol]["normal"],
                    review_recommended=protocol_category_counts[protocol][
                        "review_recommended"
                    ],
                    attack=protocol_category_counts[protocol]["attack"],
                    attack_rate=round(
                        protocol_category_counts[protocol]["attack"]
                        / max(1, sum(protocol_category_counts[protocol].values())),
                        4,
                    ),
                )
                for protocol in ("TCP", "UDP", "ICMP", "OTHER")
                if protocol in protocol_category_counts
            ],
            top_source_ips=[
                UploadChartItem(label=label, count=count)
                for label, count in flagged_source_counts.most_common(8)
            ],
            confidence_buckets=[
                ConfidenceBucket(label=label, count=confidence_counts[label])
                for label in ("0-20%", "21-40%", "41-60%", "61-80%", "81-100%")
            ],
        ),
        model_analysis=_build_model_analysis(
            model_results=model_results,
            context_df=context_df,
            fallback_best_model=best_model,
        ),
        alerts=alerts,
        review_recommended_rows=review_recommended_rows,
        records=records,
    )
    print(
        f"UPLOAD_LOG_RESPONSE_ROWS total={total_records} returned={len(records)} "
        f"truncated={total_records > len(records)} max_returned={MAX_RETURNED_RECORDS}",
        flush=True,
    )
    upload_history.record(response)
    return response


def analyze_csv_upload(filename: str, contents: bytes) -> UploadAnalysisResponse:
    return analyze_upload_file(filename=filename, contents=contents)


class UploadHistoryStore:
    def __init__(self):
        self._total_records = 0
        self._total_review_recommended = 0
        self._total_attacks = 0
        self._total_normal = 0
        self._recent_alerts: deque[AlertRecord] = deque(maxlen=100)
        self._recent_detections: deque[RecentDetectionPoint] = deque(maxlen=50)
        self._lock = Lock()

    def record(self, response: UploadAnalysisResponse) -> None:
        with self._lock:
            self._total_records += response.summary.total_records
            self._total_review_recommended += (
                response.summary.review_recommended_records
            )
            self._total_attacks += response.summary.attack_count
            self._total_normal += response.summary.normal_records
            self._recent_detections.append(
                RecentDetectionPoint(
                    timestamp=response.generated_at,
                    total_records=response.summary.total_records,
                    review_recommended_records=(
                        response.summary.review_recommended_records
                    ),
                    attack_records=response.summary.attack_count,
                )
            )
            for alert in reversed(response.alerts):
                self._recent_alerts.appendleft(alert)

    def get_summary(self) -> dict[str, int | float]:
        with self._lock:
            attack_percentage = (
                round((self._total_attacks / self._total_records) * 100, 2)
                if self._total_records
                else 0.0
            )
            return {
                "total_records": self._total_records,
                "total_review_recommended": self._total_review_recommended,
                "total_attacks": self._total_attacks,
                "total_normal": self._total_normal,
                "attack_percentage": attack_percentage,
            }

    def get_recent_alerts(self, limit: int = 25) -> list[AlertRecord]:
        with self._lock:
            return list(self._recent_alerts)[:limit]

    def get_recent_alert_count(self) -> int:
        with self._lock:
            return len(self._recent_alerts)

    def get_recent_detections(self, limit: int = 20) -> list[RecentDetectionPoint]:
        with self._lock:
            detections = list(self._recent_detections)[-limit:]
        return detections


upload_history = UploadHistoryStore()
