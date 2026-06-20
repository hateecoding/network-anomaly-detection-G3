import { requestJson } from "./api";
import type { AlertRecord, UploadAnalysisRow } from "../data/presentationData";

type UploadAnalysisResult = {
  rows: UploadAnalysisRow[];
  alerts: AlertRecord[];
  summary: {
    totalRecords: number;
    suspiciousRecords: number;
    normalRecords: number;
    attackRecords: number;
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
  result: "attack" | "normal";
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
    normal_records: number;
    attack_percentage: number;
  };
  alerts: BackendUploadAlert[];
  records: BackendUploadRecord[];
};

export async function analyzeUploadedFile(file: File): Promise<UploadAnalysisResult> {
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
    "sourceIp",
    "destinationIp",
    "protocol",
    "service",
    "duration",
    "prediction",
    "confidence",
    "alertLevel",
  ];

  const content = rows.map((row) =>
    [
      row.rowId,
      row.sourceIp,
      row.destinationIp,
      row.protocol,
      row.service,
      row.duration,
      row.prediction,
      row.confidence,
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

function mapUploadAnalysis(response: BackendUploadResponse): UploadAnalysisResult {
  const rows = response.records.map((record) => mapUploadRow(record));
  const alerts = response.alerts.map((alert, index) => mapUploadAlert(alert, index));

  return {
    rows,
    alerts,
    summary: {
      totalRecords: rows.length,
      suspiciousRecords: rows.filter((row) => row.prediction === "Suspicious").length,
      normalRecords: rows.filter((row) => row.prediction === "Normal").length,
      attackRecords: rows.filter((row) => row.prediction === "Attack").length,
    },
  };
}

function mapUploadRow(record: BackendUploadRecord): UploadAnalysisRow {
  const probabilityPercent = Math.round(clamp(record.attack_probability, 0, 1) * 100);
  const prediction = mapUploadPrediction(record);

  return {
    rowId: `ROW-${String(record.row_id).padStart(3, "0")}`,
    sourceIp: record.source_ip || "Unknown",
    destinationIp: record.destination_ip || "Unknown",
    protocol: (record.protocol || "tcp").toUpperCase(),
    service: (record.service || "-").toLowerCase(),
    duration: Number(record.duration || 0),
    prediction,
    confidence: Math.round(clamp(record.confidence, 0, 1) * 100),
    alertLevel: mapAlertLevel(record.alert_level, prediction, probabilityPercent),
  };
}

function mapUploadPrediction(
  record: BackendUploadRecord,
): UploadAnalysisRow["prediction"] {
  if (record.result === "attack") {
    return "Attack";
  }

  // Keep the existing three-state table UX by treating mid-range backend probabilities as review-worthy.
  if (record.attack_probability >= 0.4) {
    return "Suspicious";
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

  if (prediction === "Suspicious" || probabilityPercent >= 40) {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
