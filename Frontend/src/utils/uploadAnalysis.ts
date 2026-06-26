import { requestJson } from "./api";
import type { AlertRecord, UploadAnalysisRow } from "../data/presentationData";

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_CACHED_PREVIEW_ROWS = 1000;
const UPLOAD_ANALYSIS_CACHE_KEY = "aegis-net.latest-upload-analysis";
const UPLOAD_ANALYSIS_CACHE_VERSION = 2;
const CSV_TEMPLATE_HEADERS = [
  "duration",
  "src_bytes",
  "dst_bytes",
  "total_bytes",
  "byte_ratio",
  "activity_count",
  "service_count",
  "same_service_rate",
  "destination_host_count",
  "destination_host_service_count",
  "protocol_group",
  "service_group",
  "connection_group",
  "service_detail",
  "connection_detail",
];

export type UploadAnalysisResult = {
  rows: UploadAnalysisRow[];
  alerts: AlertRecord[];
  summary: UploadAnalysisSummary;
  charts: UploadAnalysisCharts;
  metadata: UploadAnalysisMetadata;
  modelAnalysis: UploadModelAnalysis;
};

export type UploadAnalysisSummary = {
  totalRecords: number;
  normalRecords: number;
  suspiciousRecords: number;
  attackRecords: number;
  attackPercentage: number;
  riskScore: number;
  processingStatus: "success" | "failed";
  filename: string;
  updatedAt: string;
};

export type UploadAnalysisCharts = {
  composition: { label: string; value: number; color: string }[];
  trend: UploadRiskTrendPoint[];
  protocolRisk: ProtocolRiskPoint[];
  topSourceIps: { label: string; value: number; color: string }[];
  probabilityBuckets: { label: string; value: number; color: string }[];
};

export type UploadRiskTrendPoint = {
  label: string;
  startRow: number;
  endRow: number;
  totalRecords: number;
  averageAttackProbability: number;
  maximumAttackProbability: number;
  normal: number;
  reviewRecommended: number;
  attack: number;
  mostCommonProtocol: string | null;
};

export type ProtocolRiskPoint = {
  protocol: string;
  totalRecords: number;
  normal: number;
  reviewRecommended: number;
  attack: number;
  attackRate: number;
};

export type UploadAnalysisMetadata = {
  totalRecords: number;
  returnedRecords: number;
  previewLimit: number;
  previewCapped: boolean;
  reviewThreshold: number;
  attackThreshold: number;
  preprocessingMode: "fitted_pipeline" | "manual_fallback";
  preprocessingArtifact: string | null;
  preprocessingWarning: string | null;
};

export type UploadModelAnalysisItem = {
  modelName: string;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  rocAuc: number | null;
  normalPredictions: number;
  attackPredictions: number;
  averageConfidence: number | null;
  confidenceBuckets: { label: string; value: number; color: string }[];
  confusionMatrix: { x: string; y: string; value: number }[];
};

export type UploadModelAnalysis = {
  labelsAvailable: boolean;
  evaluatedRecords: number;
  bestModel: string | null;
  highestRecallModel: string | null;
  highestF1Model: string | null;
  models: UploadModelAnalysisItem[];
  charts: {
    performance: { label: string; value: number; color: string; suffix: string }[];
    predictionDistribution: { label: string; value: number; color: string }[];
    confidenceBuckets: { label: string; value: number; color: string }[];
  };
};

type BackendUploadAlert = {
  created_at: string;
  alert_level?: string | null;
  source_ip?: string | null;
  route?: string | null;
  row_id?: number | null;
  confidence?: number | null;
  attack_probability?: number | null;
  message: string;
};

type BackendUploadRecord = {
  row_id: number;
  source_ip?: string | null;
  destination_ip?: string | null;
  protocol?: string | null;
  service?: string | null;
  duration?: number | null;
  src_bytes: number;
  dst_bytes: number;
  total_bytes: number;
  byte_ratio: number;
  activity_count: number;
  service_count: number;
  same_service_rate: number;
  destination_host_count: number;
  destination_host_service_count: number;
  prediction?: number;
  model_prediction: "attack" | "normal";
  display_category: "normal" | "review_recommended" | "attack";
  result: "attack" | "normal";
  detection_result?: "attack" | "normal";
  confidence: number;
  attack_probability: number;
  alert_level: string;
};

type BackendUploadResponse = {
  filename: string;
  generated_at: string;
  total_records: number;
  returned_records: number;
  records_truncated: boolean;
  max_returned_records: number;
  review_threshold: number;
  attack_threshold: number;
  preprocessing: {
    mode: "fitted_pipeline" | "manual_fallback";
    artifact?: string | null;
    warning?: string | null;
  };
  chart_data: {
    trend: {
      label: string;
      start_row: number;
      end_row: number;
      total_records: number;
      average_attack_probability: number;
      maximum_attack_probability: number;
      normal: number;
      review_recommended: number;
      attack: number;
      most_common_protocol?: string | null;
    }[];
    protocol_risk: {
      protocol: string;
      total_records: number;
      normal: number;
      review_recommended: number;
      attack: number;
      attack_rate: number;
    }[];
    top_source_ips: { label: string; count: number }[];
    confidence_buckets: { label: string; count: number }[];
  };
  summary: {
    total_records: number;
    review_recommended_records: number;
    review_recommended_rows?: number;
    normal_records: number;
    normal_count?: number;
    attack_count?: number;
    attack_percentage: number;
  };
  model_analysis?: {
    labels_available: boolean;
    evaluated_records: number;
    best_model?: string | null;
    highest_recall_model?: string | null;
    highest_f1_model?: string | null;
    models: {
      model_name: string;
      accuracy?: number | null;
      precision?: number | null;
      recall?: number | null;
      f1?: number | null;
      roc_auc?: number | null;
      normal_predictions: number;
      attack_predictions: number;
      average_confidence?: number | null;
      confidence_buckets?: { label: string; count: number }[];
      confusion_matrix?: {
        true_negative: number;
        false_positive: number;
        false_negative: number;
        true_positive: number;
      } | null;
    }[];
  } | null;
  alerts: BackendUploadAlert[];
  review_recommended_rows?: BackendUploadRecord[];
  records: BackendUploadRecord[];
};

export async function analyzeUploadedFile(file: File): Promise<UploadAnalysisResult> {
  validateUploadFile(file);
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await requestJson<BackendUploadResponse>("/upload-log", {
      method: "POST",
      body: formData,
    });

    return mapUploadAnalysis(response);
  } catch {
    throw new Error(
      "Analysis failed. Please check the uploaded file format or backend service.",
    );
  }
}

export function loadCachedUploadAnalysis(): UploadAnalysisResult | null {
  try {
    const raw = window.localStorage.getItem(UPLOAD_ANALYSIS_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const cached: unknown = JSON.parse(raw);
    if (!isCompatibleCacheEntry(cached)) {
      clearCachedUploadAnalysis();
      return null;
    }

    return {
      ...cached.data,
      rows: cached.data.rows.slice(0, MAX_CACHED_PREVIEW_ROWS),
    };
  } catch {
    clearCachedUploadAnalysis();
    return null;
  }
}

export function saveCachedUploadAnalysis(result: UploadAnalysisResult): boolean {
  try {
    const cacheEntry = {
      version: UPLOAD_ANALYSIS_CACHE_VERSION,
      savedAt: new Date().toISOString(),
      data: {
        ...result,
        rows: result.rows.slice(0, MAX_CACHED_PREVIEW_ROWS),
      },
    };
    window.localStorage.setItem(UPLOAD_ANALYSIS_CACHE_KEY, JSON.stringify(cacheEntry));
    return true;
  } catch {
    return false;
  }
}

export function clearCachedUploadAnalysis() {
  try {
    window.localStorage.removeItem(UPLOAD_ANALYSIS_CACHE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function exportUploadRows(
  rows: UploadAnalysisRow[],
  analysis?: UploadAnalysisResult,
) {
  const header = [
    "analysisFilename",
    "analysisTimestamp",
    "modelUsed",
    "rowId",
    "recordNumber",
    "sourceIp",
    "destinationIp",
    "protocol",
    "modelPrediction",
    "displayCategory",
    "confidence",
    "attackProbability",
    "detectionResult",
    "alertLevel",
  ];

  const content = rows.map((row) =>
    [
      analysis?.summary.filename ?? "",
      analysis?.summary.updatedAt ?? "",
      analysis?.modelAnalysis.bestModel ?? "",
      row.rowId,
      row.recordNumber,
      row.sourceIp,
      row.destinationIp,
      row.protocol,
      row.modelPrediction,
      row.prediction,
      row.confidence,
      row.attackProbability,
      row.detectionResult,
      row.alertLevel,
    ].join(","),
  );

  const blob = new Blob([[header.join(","), ...content].join("\n")], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "analyzed-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function exportUploadAnalysisJson(
  analysis: UploadAnalysisResult,
  rows: UploadAnalysisRow[],
) {
  const payload = {
    filename: analysis.summary.filename,
    generated_at: analysis.summary.updatedAt,
    summary: analysis.summary,
    metadata: analysis.metadata,
    charts: analysis.charts,
    model_analysis: analysis.modelAnalysis,
    exported_rows: rows,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "aegis-net-analysis.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCsvTemplate() {
  const example = [
    "12.5",
    "1200",
    "450",
    "1650",
    "2.6667",
    "8",
    "4",
    "0.5",
    "12",
    "6",
    "TCP",
    "WEB",
    "Established",
    "http",
    "sf",
  ];
  const blob = new Blob([[CSV_TEMPLATE_HEADERS.join(","), example.join(",")].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "aegis-net-upload-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function validateUploadFile(file: File) {
  const filename = file.name.toLowerCase();
  if (!filename.endsWith(".csv")) {
    throw new Error("Please upload a CSV file.");
  }

  if (file.size === 0) {
    throw new Error("The selected CSV file is empty.");
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("The selected CSV is too large. Please upload a file under 25 MB.");
  }
}

function isCompatibleCacheEntry(
  value: unknown,
): value is { version: number; savedAt: string; data: UploadAnalysisResult } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as {
    version?: unknown;
    savedAt?: unknown;
    data?: Partial<UploadAnalysisResult>;
  };
  const data = entry.data;

  return (
    entry.version === UPLOAD_ANALYSIS_CACHE_VERSION &&
    typeof entry.savedAt === "string" &&
    Boolean(data) &&
    Array.isArray(data?.rows) &&
    data.rows.length <= MAX_CACHED_PREVIEW_ROWS &&
    Array.isArray(data?.alerts) &&
    Boolean(data?.summary) &&
    typeof data?.summary?.totalRecords === "number" &&
    typeof data?.summary?.filename === "string" &&
    Boolean(data?.charts) &&
    Array.isArray(data?.charts?.composition) &&
    Array.isArray(data?.charts?.trend) &&
    Boolean(data?.metadata) &&
    typeof data?.metadata?.totalRecords === "number" &&
    typeof data?.metadata?.returnedRecords === "number" &&
    Boolean(data?.modelAnalysis) &&
    Array.isArray(data?.modelAnalysis?.models)
  );
}

function mapUploadAnalysis(response: BackendUploadResponse): UploadAnalysisResult {
  const rows = buildPreviewRows(response.records.map((record) => mapUploadRow(record)));
  const alerts = response.alerts.map((alert, index) => mapUploadAlert(alert, index));
  const attackRecords = response.chart_data.trend.reduce((total, point) => total + point.attack, 0);
  const suspiciousRecords = response.chart_data.trend.reduce(
    (total, point) => total + point.review_recommended,
    0,
  );
  const normalRecords = response.chart_data.trend.reduce((total, point) => total + point.normal, 0);
  const totalRecords = response.total_records || response.summary.total_records;
  const attackPercentage =
    typeof response.summary.attack_percentage === "number"
      ? response.summary.attack_percentage
      : calculatePercentage(attackRecords, totalRecords);

  return {
    rows,
    alerts,
    summary: {
      totalRecords,
      suspiciousRecords,
      normalRecords,
      attackRecords,
      attackPercentage,
      riskScore: calculateRiskScore(attackPercentage, suspiciousRecords, totalRecords),
      processingStatus: "success",
      filename: response.filename,
      updatedAt: response.generated_at,
    },
    charts: buildUploadCharts(response.chart_data, {
      totalRecords,
      normalRecords,
      suspiciousRecords,
      attackRecords,
    }),
    metadata: {
      totalRecords,
      returnedRecords: response.returned_records,
      previewLimit: response.max_returned_records,
      previewCapped: response.records_truncated,
      reviewThreshold: response.review_threshold,
      attackThreshold: response.attack_threshold,
      preprocessingMode: response.preprocessing?.mode ?? "manual_fallback",
      preprocessingArtifact: response.preprocessing?.artifact ?? null,
      preprocessingWarning: response.preprocessing?.warning ?? null,
    },
    modelAnalysis: mapModelAnalysis(response.model_analysis),
  };
}

function mapModelAnalysis(response?: BackendUploadResponse["model_analysis"]): UploadModelAnalysis {
  const models =
    response?.models.map((model) => ({
      modelName: model.model_name,
      accuracy: normalizeMetric(model.accuracy),
      precision: normalizeMetric(model.precision),
      recall: normalizeMetric(model.recall),
      f1: normalizeMetric(model.f1),
      rocAuc: normalizeMetric(model.roc_auc),
      normalPredictions: model.normal_predictions,
      attackPredictions: model.attack_predictions,
      averageConfidence: normalizeMetric(model.average_confidence),
      confidenceBuckets: (model.confidence_buckets ?? []).map((bucket) => ({
        label: `${formatModelName(model.model_name)} ${bucket.label}`,
        value: bucket.count,
        color: "#60a5fa",
      })),
      confusionMatrix: model.confusion_matrix
        ? [
            { x: "Pred Normal", y: "Actual Normal", value: model.confusion_matrix.true_negative },
            { x: "Pred Attack", y: "Actual Normal", value: model.confusion_matrix.false_positive },
            { x: "Pred Normal", y: "Actual Attack", value: model.confusion_matrix.false_negative },
            { x: "Pred Attack", y: "Actual Attack", value: model.confusion_matrix.true_positive },
          ]
        : [],
    })) ?? [];

  return {
    labelsAvailable: response?.labels_available ?? false,
    evaluatedRecords: response?.evaluated_records ?? 0,
    bestModel: response?.best_model ?? null,
    highestRecallModel: response?.highest_recall_model ?? null,
    highestF1Model: response?.highest_f1_model ?? null,
    models,
    charts: {
      performance: buildModelPerformanceChart(models, response?.labels_available ?? false),
      predictionDistribution: buildModelPredictionDistribution(models),
      confidenceBuckets: models.flatMap((model) => model.confidenceBuckets),
    },
  };
}

function mapUploadRow(record: BackendUploadRecord): UploadAnalysisRow {
  const probabilityPercent = Math.round(clamp(record.attack_probability, 0, 1) * 100);
  const prediction = mapUploadPrediction(record);

  return {
    rowId: `ROW-${String(record.row_id).padStart(3, "0")}`,
    recordNumber: record.row_id,
    sourceIp: record.source_ip || "Unknown",
    destinationIp: record.destination_ip || "Unknown",
    protocol: (record.protocol || "tcp").toUpperCase(),
    service: (record.service || "-").toLowerCase(),
    duration: Number(record.duration || 0),
    srcBytes: record.src_bytes,
    dstBytes: record.dst_bytes,
    totalBytes: record.total_bytes,
    byteRatio: record.byte_ratio,
    activityCount: record.activity_count,
    serviceCount: record.service_count,
    sameServiceRate: record.same_service_rate,
    destinationHostCount: record.destination_host_count,
    destinationHostServiceCount: record.destination_host_service_count,
    modelPrediction: record.model_prediction === "attack" ? "Attack" : "Normal",
    prediction,
    confidence: Math.round(clamp(record.confidence, 0, 1) * 100),
    alertLevel: mapAlertLevel(record.alert_level, prediction, probabilityPercent),
    detectionResult:
      prediction === "Attack"
        ? "ATTACK DETECTED"
        : prediction === "Review Recommended"
          ? "REVIEW RECOMMENDED"
          : "NORMAL",
    attackProbability: probabilityPercent,
  };
}

function mapUploadPrediction(
  record: BackendUploadRecord,
): UploadAnalysisRow["prediction"] {
  if (record.display_category === "attack") {
    return "Attack";
  }
  if (record.display_category === "review_recommended") {
    return "Review Recommended";
  }
  return "Normal";
}

function mapUploadAlert(alert: BackendUploadAlert, index: number): AlertRecord {
  const severity = mapSeverity(alert.alert_level);
  const rowId = alert.row_id
    ? `ROW-${String(alert.row_id).padStart(3, "0")}`
    : `UPL-${String(index + 1).padStart(3, "0")}`;
  const probabilityText =
    typeof alert.attack_probability === "number"
      ? ` Attack probability ${Math.round(clamp(alert.attack_probability, 0, 1) * 100)}%.`
      : "";

  return {
    id: `UPL-${String(index + 1).padStart(3, "0")}`,
    title: severity === "attack" ? `High-risk ${rowId}` : `Review ${rowId}`,
    severity,
    source: alert.source_ip || "Unknown source",
    route: alert.route || "/upload-log",
    timestamp: formatTimestamp(alert.created_at),
    detail: `${alert.message}${probabilityText}`,
  };
}

function mapSeverity(value?: string | null): AlertRecord["severity"] {
  if (value?.toLowerCase() === "high") {
    return "attack";
  }

  return "suspicious";
}

function mapAlertLevel(
  level: string,
  prediction: UploadAnalysisRow["prediction"],
  probabilityPercent: number,
): UploadAnalysisRow["alertLevel"] {
  if (prediction === "Attack") {
    return level.toLowerCase() === "high" ? "High" : "Medium";
  }

  if (prediction === "Review Recommended") {
    return "Medium";
  }

  return "Low";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildPreviewRows(rows: UploadAnalysisRow[]) {
  return [...rows]
    .sort((left, right) => getPriority(right) - getPriority(left) || left.recordNumber - right.recordNumber);
}

function buildUploadCharts(
  chartData: BackendUploadResponse["chart_data"],
  summary: Pick<UploadAnalysisSummary, "totalRecords" | "normalRecords" | "suspiciousRecords" | "attackRecords">,
): UploadAnalysisCharts {
  return {
    composition: [
      { label: "Normal", value: summary.normalRecords, color: "#34d399" },
      { label: "Review Recommended", value: summary.suspiciousRecords, color: "#fbbf24" },
      { label: "Attack", value: summary.attackRecords, color: "#f97316" },
    ],
    trend: chartData.trend.map((point) => ({
      label: point.label,
      startRow: point.start_row,
      endRow: point.end_row,
      totalRecords: point.total_records,
      averageAttackProbability: point.average_attack_probability,
      maximumAttackProbability: point.maximum_attack_probability,
      normal: point.normal,
      reviewRecommended: point.review_recommended,
      attack: point.attack,
      mostCommonProtocol: point.most_common_protocol ?? null,
    })),
    protocolRisk: chartData.protocol_risk.map((item) => ({
      protocol: item.protocol,
      totalRecords: item.total_records,
      normal: item.normal,
      reviewRecommended: item.review_recommended,
      attack: item.attack,
      attackRate: item.attack_rate,
    })),
    topSourceIps: chartData.top_source_ips.map((item) => ({
      label: item.label,
      value: item.count,
      color: "#f97316",
    })),
    probabilityBuckets: chartData.confidence_buckets.map((item, index) => ({
      label: item.label,
      value: item.count,
      color: ["#34d399", "#5eead4", "#fbbf24", "#fb923c", "#ef4444"][index],
    })),
  };
}

function buildModelPerformanceChart(models: UploadModelAnalysisItem[], labelsAvailable: boolean) {
  if (!labelsAvailable) {
    return [];
  }

  const metricColors: Record<string, string> = {
    Accuracy: "#60a5fa",
    Precision: "#5eead4",
    Recall: "#fbbf24",
    F1: "#f97316",
  };

  return models.flatMap((model) =>
    [
      ["Accuracy", model.accuracy],
      ["Precision", model.precision],
      ["Recall", model.recall],
      ["F1", model.f1],
    ].flatMap(([metric, value]) =>
      typeof value === "number"
        ? [
            {
              label: `${formatModelName(model.modelName)} ${metric}`,
              value: Math.round(value * 10000) / 100,
              color: metricColors[String(metric)],
              suffix: "%",
            },
          ]
        : [],
    ),
  );
}

function buildModelPredictionDistribution(models: UploadModelAnalysisItem[]) {
  return models.flatMap((model) => [
    {
      label: `${formatModelName(model.modelName)} Normal`,
      value: model.normalPredictions,
      color: "#34d399",
    },
    {
      label: `${formatModelName(model.modelName)} Attack`,
      value: model.attackPredictions,
      color: "#f97316",
    },
  ]);
}

export function formatModelName(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return value
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatModelMetric(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "N/A";
  }

  return `${Math.round(value * 10000) / 100}%`;
}

function normalizeMetric(value?: number | null) {
  return typeof value === "number" ? value : null;
}

function calculateRiskScore(attackPercentage: number, suspiciousRecords: number, totalRecords: number) {
  const reviewPressure = calculatePercentage(suspiciousRecords, totalRecords);
  return Math.round(clamp(attackPercentage * 1.5 + reviewPressure * 0.65, 0, 100));
}

function calculatePercentage(value: number, total: number) {
  return total > 0 ? roundToTwo((value / total) * 100) : 0;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function getPriority(row: UploadAnalysisRow) {
  if (row.prediction === "Attack") {
    return 2;
  }

  if (row.prediction === "Review Recommended") {
    return 1;
  }

  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
