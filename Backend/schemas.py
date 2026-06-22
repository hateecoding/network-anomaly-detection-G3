from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class TrafficInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    duration: float = 0.0
    src_bytes: float = 0.0
    dst_bytes: float = 0.0
    total_bytes: float = 0.0
    byte_ratio: float = 0.0
    activity_count: float = 0.0
    service_count: float = 0.0
    same_service_rate: float = 0.0
    destination_host_count: float = 0.0
    destination_host_service_count: float = 0.0
    protocol_group: str = "OTHER"
    service_group: str = "OTHER"
    connection_group: str = "ERROR"
    service_detail: str = "other"
    connection_detail: str = "unknown"
    protocol_type: str = "tcp"
    flag: str = "sf"
    count: int = 0
    srv_count: int = 0
    dst_host_count: int = 0
    dst_host_srv_count: int = 0
    same_srv_rate: float = 0.0
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    route: Optional[str] = None
    label: Optional[Union[str, int]] = None
    attack_name: Optional[str] = None
    attack_cat: Optional[str] = None

    dur: float = 0.0
    proto: str = "tcp"
    service: str = "-"
    state: str = "no"
    spkts: int = 0
    dpkts: int = 0
    sbytes: int = 0
    dbytes: int = 0
    rate: float = 0.0
    sttl: int = 0
    dttl: int = 0
    sload: float = 0.0
    dload: float = 0.0
    sloss: int = 0
    dloss: int = 0
    sinpkt: float = 0.0
    dinpkt: float = 0.0
    sjit: float = 0.0
    djit: float = 0.0
    swin: int = 0
    stcpb: int = 0
    dtcpb: int = 0
    dwin: int = 0
    tcprtt: float = 0.0
    synack: float = 0.0
    ackdat: float = 0.0
    smean: int = 0
    dmean: int = 0
    trans_depth: int = 0
    response_body_len: int = 0
    ct_srv_src: int = 0
    ct_state_ttl: int = 0
    ct_dst_ltm: int = 0
    ct_src_dport_ltm: int = 0
    ct_dst_sport_ltm: int = 0
    ct_dst_src_ltm: int = 0
    is_ftp_login: int = 0
    ct_ftp_cmd: int = 0
    ct_flw_http_mthd: int = 0
    ct_src_ltm: int = 0
    ct_srv_dst: int = 0
    is_sm_ips_ports: int = 0


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


class RecentDetectionPoint(BaseModel):
    timestamp: datetime
    total_records: int
    suspicious_records: int


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
    suspicious_records: int
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
    suspicious_records: int
    suspicious_rows: int
    normal_records: int
    normal_count: int
    attack_count: int
    attack_percentage: float
    top_attack_type: Optional[str] = None
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
    prediction: int
    result: Literal["attack", "normal"]
    detection_result: Literal["attack", "normal"]
    attack_probability: float
    confidence: float
    alert_level: str
    model_results: dict[str, ModelPredictionResult] = Field(default_factory=dict)


class UploadAnalysisResponse(BaseModel):
    generated_at: datetime
    filename: str
    summary: UploadSummary
    model_analysis: Optional[UploadModelAnalysis] = None
    alerts: list[AlertRecord] = Field(default_factory=list)
    suspicious_rows: list[UploadRecordResult] = Field(default_factory=list)
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
    total_suspicious: int
    total_normal: int
    attack_percentage: float
    recent_alerts_count: int
    active_visitors: int
    suspicious_visitors: int
    total_requests_last_5_minutes: int
    recent_detections: list[RecentDetectionPoint] = Field(default_factory=list)
    latest_self_test_result: Optional[PredictionResponse] = None
