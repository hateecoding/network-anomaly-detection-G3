import { requestJson } from "./api";
import { getDisplayCategory, REVIEW_THRESHOLD } from "../config/thresholds";
import type { AlertRecord, DetectionTrendPoint, UploadAnalysisRow } from "../data/presentationData";

const MAX_PREVIEW_ROWS = 1000;
const TREND_BUCKET_COUNT = 12;
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const CSV_TEMPLATE_HEADERS = [
  "duration",
  "src_bytes",
  "dst_bytes",
  "protocol_type",
  "service",
  "flag",
  "count",
  "srv_count",
  "same_srv_rate",
  "dst_host_count",
  "dst_host_srv_count",
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
  topAttackType: string;
  processingStatus: "success" | "failed";
  filename: string;
  updatedAt: string;
};

export type UploadAnalysisCharts = {
  composition: { label: string; value: number; color: string }[];
  trend: DetectionTrendPoint[];
  protocols: { label: string; value: number; color: string }[];
  topSourceIps: { label: string; value: number; color: string }[];
  confidenceBuckets: { label: string; value: number; color: string }[];
};

export type UploadAnalysisMetadata = {
  totalRecordsReturned: number;
  previewLimit: number;
  previewCapped: boolean;
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
  prediction?: number;
  result: "attack" | "normal";
  detection_result?: "attack" | "normal";
  confidence: number;
  attack_probability: number;
  alert_level: string;
};

type BackendUploadResponse = {
  filename: string;
  generated_at: string;
  summary: {
    total_records: number;
    suspicious_records: number;
    suspicious_rows?: number;
    normal_records: number;
    normal_count?: number;
    attack_count?: number;
    attack_percentage: number;
    top_attack_type?: string | null;
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
  suspicious_rows?: BackendUploadRecord[];
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

export function exportUploadRows(rows: UploadAnalysisRow[]) {
  const header = [
    "rowId",
    "recordNumber",
    "sourceIp",
    "destinationIp",
    "protocol",
    "prediction",
    "confidence",
    "attackProbability",
    "detectionResult",
    "alertLevel",
  ];

  const content = rows.map((row) =>
    [
      row.rowId,
      row.recordNumber,
      row.sourceIp,
      row.destinationIp,
      row.protocol,
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

export function exportCsvTemplate() {
  const example = [
    "12.5",
    "1200",
    "450",
    "tcp",
    "http",
    "SF",
    "8",
    "4",
    "0.5",
    "12",
    "6",
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

function mapUploadAnalysis(response: BackendUploadResponse): UploadAnalysisResult {
  const allRows = response.records.map((record) => mapUploadRow(record));
  const rows = buildPreviewRows(allRows);
  const alerts = response.alerts.map((alert, index) => mapUploadAlert(alert, index));
  const attackRecords = allRows.filter((row) => row.prediction === "Attack").length;
  const suspiciousRecords = allRows.filter((row) => row.prediction === "Review Recommended").length;
  const normalRecords = allRows.filter((row) => row.prediction === "Normal").length;
  const totalRecords = response.summary.total_records || allRows.length;
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
      topAttackType: response.summary.top_attack_type || "Not reported",
      processingStatus: "success",
      filename: response.filename,
      updatedAt: response.generated_at,
    },
    charts: buildUploadCharts(allRows, {
      totalRecords,
      normalRecords,
      suspiciousRecords,
      attackRecords,
    }),
    metadata: {
      totalRecordsReturned: allRows.length,
      previewLimit: MAX_PREVIEW_ROWS,
      previewCapped: allRows.length > MAX_PREVIEW_ROWS,
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
    prediction,
    confidence: Math.round(clamp(record.confidence, 0, 1) * 100),
    alertLevel: mapAlertLevel(record.alert_level, prediction, probabilityPercent),
    detectionResult: prediction === "Attack" ? "THREAT DETECTED" : "SAFE",
    attackProbability: probabilityPercent,
  };
}

function mapUploadPrediction(
  record: BackendUploadRecord,
): UploadAnalysisRow["prediction"] {
  return getDisplayCategory(record.result, record.attack_probability);
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

  if (prediction === "Review Recommended" || probabilityPercent >= REVIEW_THRESHOLD * 100) {
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
    .sort((left, right) => getPriority(right) - getPriority(left) || left.recordNumber - right.recordNumber)
    .slice(0, MAX_PREVIEW_ROWS);
}

function buildUploadCharts(
  rows: UploadAnalysisRow[],
  summary: Pick<UploadAnalysisSummary, "totalRecords" | "normalRecords" | "suspiciousRecords" | "attackRecords">,
): UploadAnalysisCharts {
  return {
    composition: [
      { label: "Normal", value: summary.normalRecords, color: "#34d399" },
      { label: "Review Recommended", value: summary.suspiciousRecords, color: "#fbbf24" },
      { label: "Attack", value: summary.attackRecords, color: "#f97316" },
    ],
    trend: buildTrend(rows),
    protocols: buildProtocolDistribution(rows),
    topSourceIps: buildTopSourceIps(rows),
    confidenceBuckets: buildConfidenceBuckets(rows),
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

function buildTrend(rows: UploadAnalysisRow[]): DetectionTrendPoint[] {
  if (rows.length === 0) {
    return [];
  }

  const bucketSize = Math.max(1, Math.ceil(rows.length / TREND_BUCKET_COUNT));
  const points: DetectionTrendPoint[] = [];

  for (let start = 0; start < rows.length; start += bucketSize) {
    const bucket = rows.slice(start, start + bucketSize);
    const first = start + 1;
    const last = start + bucket.length;

    points.push({
      label: `${first}-${last}`,
      normal: bucket.filter((row) => row.prediction === "Normal").length,
      suspicious: bucket.filter((row) => row.prediction === "Review Recommended").length,
      attack: bucket.filter((row) => row.prediction === "Attack").length,
    });
  }

  return points;
}

function buildProtocolDistribution(rows: UploadAnalysisRow[]) {
  const counts = rows.reduce<Record<string, number>>((accumulator, row) => {
    const protocol = normalizeProtocol(row.protocol);
    accumulator[protocol] = (accumulator[protocol] ?? 0) + 1;
    return accumulator;
  }, {});

  return ["TCP", "UDP", "ICMP", "OTHER"]
    .map((label, index) => ({
      label,
      value: counts[label] ?? 0,
      color: ["#60a5fa", "#5eead4", "#fbbf24", "#94a3b8"][index],
    }))
    .filter((item) => item.value > 0);
}

function buildTopSourceIps(rows: UploadAnalysisRow[]) {
  const counts = rows.reduce<Record<string, number>>((accumulator, row) => {
    if (row.prediction === "Normal" || row.sourceIp === "Unknown") {
      return accumulator;
    }

    accumulator[row.sourceIp] = (accumulator[row.sourceIp] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value, color: "#f97316" }));
}

function buildConfidenceBuckets(rows: UploadAnalysisRow[]) {
  const buckets = [
    { label: "0-20%", min: 0, max: 20, value: 0 },
    { label: "21-40%", min: 21, max: 40, value: 0 },
    { label: "41-60%", min: 41, max: 60, value: 0 },
    { label: "61-80%", min: 61, max: 80, value: 0 },
    { label: "81-100%", min: 81, max: 100, value: 0 },
  ];

  rows.forEach((row) => {
    const match = buckets.find((bucket) => row.confidence >= bucket.min && row.confidence <= bucket.max);
    if (match) {
      match.value += 1;
    }
  });

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.value,
    color: "#60a5fa",
  }));
}

function normalizeProtocol(value: string) {
  const normalized = value.trim().toUpperCase();

  if (normalized.includes("TCP")) {
    return "TCP";
  }

  if (normalized.includes("UDP")) {
    return "UDP";
  }

  if (normalized.includes("ICMP")) {
    return "ICMP";
  }

  return "OTHER";
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
