from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class TrafficInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    duration: float = Field(..., ge=0, le=604_800)
    src_bytes: float = Field(..., ge=0)
    dst_bytes: float = Field(..., ge=0)
    total_bytes: float = Field(..., ge=0)
    byte_ratio: float = Field(..., ge=0)
    activity_count: float = Field(..., ge=0)
    service_count: float = Field(..., ge=0)
    same_service_rate: float = Field(..., ge=0, le=1)
    destination_host_count: float = Field(..., ge=0)
    destination_host_service_count: float = Field(..., ge=0)
    protocol_group: Literal["TCP", "UDP", "ICMP", "OTHER"]
    service_group: Literal["DNS", "EMAIL", "FILE", "INFRA", "OTHER", "REMOTE", "WEB"]
    connection_group: Literal[
        "Attempted",
        "ERROR",
        "Established",
        "Rejected",
        "Reset",
    ]
    service_detail: str = Field(..., min_length=1, max_length=64)
    connection_detail: str = Field(..., min_length=1, max_length=64)
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    route: Optional[str] = None


class ModelPerformanceMetrics(BaseModel):
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    roc_auc: Optional[float] = None
    predicted_attack_percentage: Optional[float] = None
    actual_attack_percentage: Optional[float] = None
    contamination: Optional[float] = None


class ModelPredictionResult(BaseModel):
    prediction: int
    result: Literal["attack", "normal"]
    attack_probability: float
    confidence: float
    score: Optional[float] = None


class PreprocessingStatus(BaseModel):
    mode: Literal["fitted_pipeline", "manual_fallback"]
    artifact: Optional[str] = None
    warning: Optional[str] = None


class PredictionResponse(BaseModel):
    prediction: int
    result: Literal["attack", "normal"]
    detection_result: Literal["attack", "normal"]
    attack_probability: float
    confidence: float
    timestamp: datetime
    model_used: str = "xgboost"
    best_model: str = "xgboost"
    selection_metric: Optional[str] = None
    best_model_metrics: Optional[ModelPerformanceMetrics] = None
    model_results: dict[str, ModelPredictionResult] = Field(default_factory=dict)
    preprocessing: PreprocessingStatus


class RecentDetectionPoint(BaseModel):
    timestamp: datetime
    total_records: int
    review_recommended_records: int
    attack_records: int


class AlertRecord(BaseModel):
    alert_type: Literal["upload", "visitor"]
    created_at: datetime
    message: str
    alert_level: Optional[str] = None
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    route: Optional[str] = None
    row_id: Optional[int] = None
    prediction: Optional[int] = None
    result: Optional[Literal["attack", "normal"]] = None
    confidence: Optional[float] = None
    attack_probability: Optional[float] = None


class UploadModelBreakdown(BaseModel):
    attack_records: int
    normal_records: int
    attack_percentage: float


class ConfidenceBucket(BaseModel):
    label: str
    count: int


class ConfusionMatrix(BaseModel):
    true_negative: int
    false_positive: int
    false_negative: int
    true_positive: int


class UploadModelAnalysisItem(BaseModel):
    model_name: str
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    roc_auc: Optional[float] = None
    normal_predictions: int
    attack_predictions: int
    average_confidence: Optional[float] = None
    confidence_buckets: list[ConfidenceBucket] = Field(default_factory=list)
    confusion_matrix: Optional[ConfusionMatrix] = None


class UploadModelAnalysis(BaseModel):
    labels_available: bool
    evaluated_records: int
    best_model: Optional[str] = None
    highest_recall_model: Optional[str] = None
    highest_f1_model: Optional[str] = None
    models: list[UploadModelAnalysisItem] = Field(default_factory=list)


class UploadSummary(BaseModel):
    total_records: int
    review_recommended_records: int
    review_recommended_rows: int
    normal_records: int
    normal_count: int
    attack_count: int
    attack_percentage: float
    model_used: str = "xgboost"
    best_model: str = "xgboost"
    selection_metric: Optional[str] = None
    best_model_metrics: Optional[ModelPerformanceMetrics] = None
    model_summaries: dict[str, UploadModelBreakdown] = Field(default_factory=dict)


class UploadRecordResult(BaseModel):
    row_id: int
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    protocol: Optional[str] = None
    service: Optional[str] = None
    duration: Optional[float] = None
    src_bytes: float
    dst_bytes: float
    total_bytes: float
    byte_ratio: float
    activity_count: float
    service_count: float
    same_service_rate: float
    destination_host_count: float
    destination_host_service_count: float
    prediction: int
    model_prediction: Literal["attack", "normal"]
    display_category: Literal["normal", "review_recommended", "attack"]
    result: Literal["attack", "normal"]
    detection_result: Literal["attack", "normal"]
    attack_probability: float
    confidence: float
    alert_level: str
    model_results: dict[str, ModelPredictionResult] = Field(default_factory=dict)


class UploadChartItem(BaseModel):
    label: str
    count: int


class UploadTrendPoint(BaseModel):
    label: str
    start_row: int
    end_row: int
    total_records: int
    average_attack_probability: float
    maximum_attack_probability: float
    normal: int
    review_recommended: int
    attack: int
    most_common_protocol: Optional[str] = None


class ProtocolRiskItem(BaseModel):
    protocol: str
    total_records: int
    normal: int
    review_recommended: int
    attack: int
    attack_rate: float


class UploadChartData(BaseModel):
    trend: list[UploadTrendPoint] = Field(default_factory=list)
    protocol_risk: list[ProtocolRiskItem] = Field(default_factory=list)
    top_source_ips: list[UploadChartItem] = Field(default_factory=list)
    confidence_buckets: list[ConfidenceBucket] = Field(default_factory=list)


class UploadAnalysisResponse(BaseModel):
    generated_at: datetime
    filename: str
    summary: UploadSummary
    total_records: int
    returned_records: int
    records_truncated: bool
    max_returned_records: int
    review_threshold: float
    attack_threshold: float
    preprocessing: PreprocessingStatus
    chart_data: UploadChartData
    model_analysis: Optional[UploadModelAnalysis] = None
    alerts: list[AlertRecord] = Field(default_factory=list)
    review_recommended_rows: list[UploadRecordResult] = Field(default_factory=list)
    records: list[UploadRecordResult] = Field(default_factory=list)


class AlertsResponse(BaseModel):
    generated_at: datetime
    items: list[AlertRecord] = Field(default_factory=list)


class LiveActivityEvent(BaseModel):
    timestamp: datetime
    source_ip: Optional[str] = None
    route: str
    method: str
    status_code: int
    suspicious: bool
    reason: Optional[str] = None


class LiveVisitorsResponse(BaseModel):
    generated_at: datetime
    active_visitors: int
    suspicious_visitors: int
    total_requests_last_5_minutes: int
    recent_suspicious_requests: list[LiveActivityEvent] = Field(default_factory=list)
    latest_activity: list[LiveActivityEvent] = Field(default_factory=list)


class TrackVisitInput(BaseModel):
    route: str
    timestamp: Optional[datetime] = None


class TopRouteEntry(BaseModel):
    route: str
    request_count: int
    suspicious_count: int


class TopRoutesResponse(BaseModel):
    generated_at: datetime
    items: list[TopRouteEntry] = Field(default_factory=list)


class ModelMetricsItem(BaseModel):
    model_name: str
    recommended: bool = False
    metrics: Optional[ModelPerformanceMetrics] = None


class ModelMetricsResponse(BaseModel):
    generated_at: datetime
    selection_metric: Optional[str] = None
    recommended_model: Optional[str] = None
    items: list[ModelMetricsItem] = Field(default_factory=list)


class DashboardSummaryResponse(BaseModel):
    generated_at: datetime
    total_records: int
    total_review_recommended: int
    total_attacks: int
    total_normal: int
    attack_percentage: float
    recent_alerts_count: int
    active_visitors: int
    suspicious_visitors: int
    total_requests_last_5_minutes: int
    recent_detections: list[RecentDetectionPoint] = Field(default_factory=list)
    latest_self_test_result: Optional[PredictionResponse] = None
