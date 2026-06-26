import type {
  AlertRecord,
  DetectionTrendPoint,
  SummaryMetric,
} from "../data/presentationData";
import { requestJson } from "./api";
import { loadCachedUploadAnalysis, type UploadAnalysisResult } from "./uploadAnalysis";

type BackendDashboardSummary = {
  total_records: number;
  total_review_recommended: number;
  total_attacks: number;
  total_normal: number;
  attack_percentage: number;
  recent_alerts_count: number;
  active_visitors: number;
  suspicious_visitors: number;
  total_requests_last_5_minutes: number;
  recent_detections: {
    timestamp: string;
    total_records: number;
    review_recommended_records: number;
    attack_records: number;
  }[];
  latest_self_test_result?: {
    result: "attack" | "normal";
    attack_probability: number;
    confidence: number;
    timestamp: string;
  } | null;
};

type BackendAlertsResponse = {
  items: {
    alert_type: "upload" | "visitor";
    created_at: string;
    message: string;
    alert_level?: string | null;
    source_ip?: string | null;
    route?: string | null;
    row_id?: number | null;
    result?: "attack" | "normal" | null;
    confidence?: number | null;
    attack_probability?: number | null;
  }[];
};

export type DashboardBackendData = {
  source: "backend" | "cache" | "empty";
  sourceMessage: string;
  sourceTimestamp: string | null;
  metrics: SummaryMetric[];
  visitorMetrics: SummaryMetric[];
  distribution: { label: string; value: number; tone: "info" | "suspicious" | "attack"; color: string }[];
  detectionTrend: DetectionTrendPoint[];
  alerts: AlertRecord[];
  topRoutes: {
    route: string;
    totalHits: number;
    suspiciousHits: number;
    tone: "info" | "suspicious" | "attack" | "normal";
  }[];
  latestSelfTest: {
    label: "Normal" | "Attack";
    confidence: number;
    score: number;
    interpretation: string;
    testedAt: string;
  } | null;
};

type BackendTopRoutesResponse = {
  items: {
    route: string;
    request_count: number;
    suspicious_count: number;
  }[];
};

export async function fetchDashboardBackendData(): Promise<DashboardBackendData> {
  const cachedAnalysis = loadCachedUploadAnalysis();

  try {
    // Dashboard is backend-first; local upload cache is only used when the backend has no upload summary.
    const [summary, alerts, routes] = await Promise.all([
      requestJson<BackendDashboardSummary>("/dashboard-summary"),
      requestJson<BackendAlertsResponse>("/alerts?limit=4"),
      requestJson<BackendTopRoutesResponse>("/top-routes?limit=5"),
    ]);

    const backendData = mapBackendDashboardData(summary, alerts, routes);
    if (!hasUploadActivity(backendData) && cachedAnalysis) {
      // Preserves the latest Upload Logs result across page navigation without inventing fallback metrics.
      return mergeCachedUploadWithBackend(cachedAnalysis, backendData);
    }

    return backendData;
  } catch (error) {
    if (cachedAnalysis) {
      return mapCachedUploadDashboardData(cachedAnalysis);
    }
    throw error;
  }
}

function mapBackendDashboardData(
  summary: BackendDashboardSummary,
  alerts: BackendAlertsResponse,
  routes: BackendTopRoutesResponse,
): DashboardBackendData {
  if (!hasBackendSummaryActivity(summary)) {
    return {
      source: "empty",
      sourceMessage: "No analysis recorded yet.",
      sourceTimestamp: null,
      metrics: [],
      visitorMetrics: buildVisitorMetrics(summary),
      distribution: [],
      detectionTrend: [],
      alerts: [],
      topRoutes: mapTopRoutes(routes),
      latestSelfTest: mapLatestSelfTest(summary),
    };
  }

  return {
    source: hasBackendSummaryActivity(summary) ? "backend" : "empty",
    sourceMessage: hasBackendSummaryActivity(summary)
      ? `Last sync: ${formatDateTime(new Date().toISOString())}`
      : "No analysis recorded yet.",
    sourceTimestamp: hasBackendSummaryActivity(summary)
      ? new Date().toISOString()
      : null,
    metrics: [
      {
        label: "Uploaded Records",
        value: summary.total_records.toLocaleString(),
        helper: "Rows processed by backend analysis",
        tone: "info",
      },
      {
        label: "Review Recommended",
        value: summary.total_review_recommended.toLocaleString(),
        helper: "Rows requiring analyst review",
        tone: "suspicious",
      },
      {
        label: "Attack Records",
        value: summary.total_attacks.toLocaleString(),
        helper: "Rows classified as attack traffic",
        tone: "attack",
      },
      {
        label: "Normal Records",
        value: summary.total_normal.toLocaleString(),
        helper: "Rows classified as normal traffic",
        tone: "normal",
      },
      {
        label: "Attack Percentage",
        value: `${summary.attack_percentage.toFixed(2)}%`,
        helper: "Flagged share across processed records",
        tone: "attack",
      },
    ],
    visitorMetrics: buildVisitorMetrics(summary),
    distribution: [
      {
        label: "Normal",
        value: summary.total_normal,
        tone: "info",
        color: "#34d399",
      },
      {
        label: "Review Recommended",
        value: summary.total_review_recommended,
        tone: "suspicious",
        color: "#fbbf24",
      },
      {
        label: "Attack",
        value: summary.total_attacks,
        tone: "attack",
        color: "#ef4444",
      },
    ],
    detectionTrend: summary.recent_detections.map((point) => ({
      label: formatTime(point.timestamp),
      normal: Math.max(
        0,
        point.total_records -
          point.review_recommended_records -
          point.attack_records,
      ),
      suspicious: point.review_recommended_records,
      attack: point.attack_records,
    })),
    alerts: alerts.items.map((alert, index) => ({
      id: `ALT-${String(index + 1).padStart(3, "0")}`,
      title: alert.alert_level?.toLowerCase() === "high" ? "High-risk activity" : "Security alert",
      severity: alert.alert_level?.toLowerCase() === "high" ? "attack" : "suspicious",
      source: alert.source_ip || "Network source",
      route: alert.route || (alert.alert_type === "upload" ? "/upload-log" : "/live-visitors"),
      timestamp: formatDateTime(alert.created_at),
      detail: alert.message,
    })),
    topRoutes: mapTopRoutes(routes),
    latestSelfTest: mapLatestSelfTest(summary),
  };
}

function mergeCachedUploadWithBackend(
  cachedAnalysis: UploadAnalysisResult,
  backendData: DashboardBackendData,
): DashboardBackendData {
  const cachedData = mapCachedUploadDashboardData(cachedAnalysis);
  return {
    ...cachedData,
    visitorMetrics: backendData.visitorMetrics,
    topRoutes: backendData.topRoutes,
    latestSelfTest: backendData.latestSelfTest,
    alerts: backendData.alerts.length > 0 ? backendData.alerts : cachedData.alerts,
  };
}

function mapCachedUploadDashboardData(
  analysis: UploadAnalysisResult,
): DashboardBackendData {
  // This fallback reads the same localStorage entry written by Upload Logs after a successful /upload-log.
  const { summary } = analysis;
  return {
    source: "cache",
    sourceMessage: `Restored from local cache: ${formatDateTime(summary.updatedAt)}`,
    sourceTimestamp: summary.updatedAt,
    metrics: [
      {
        label: "Uploaded Records",
        value: summary.totalRecords.toLocaleString(),
        helper: `Latest cached analysis: ${summary.filename}`,
        tone: "info",
      },
      {
        label: "Review Recommended",
        value: summary.suspiciousRecords.toLocaleString(),
        helper: "Rows requiring analyst review",
        tone: "suspicious",
      },
      {
        label: "Attack Records",
        value: summary.attackRecords.toLocaleString(),
        helper: "Rows classified as attack traffic",
        tone: "attack",
      },
      {
        label: "Normal Records",
        value: summary.normalRecords.toLocaleString(),
        helper: "Rows classified as normal traffic",
        tone: "normal",
      },
      {
        label: "Attack Percentage",
        value: `${summary.attackPercentage.toFixed(2)}%`,
        helper: "Flagged share in cached upload",
        tone: "attack",
      },
    ],
    visitorMetrics: [],
    distribution: analysis.charts.composition.map((segment) => ({
      label: segment.label,
      value: segment.value,
      tone: segment.label === "Attack" ? "attack" : segment.label === "Review Recommended" ? "suspicious" : "info",
      color: segment.color,
    })),
    detectionTrend: analysis.charts.trend.map((point) => ({
      label: point.label,
      normal: point.normal,
      suspicious: point.reviewRecommended,
      attack: point.attack,
    })),
    alerts: buildCachedAlerts(analysis),
    topRoutes: [],
    latestSelfTest: null,
  };
}

function buildCachedAlerts(analysis: UploadAnalysisResult): AlertRecord[] {
  if (analysis.alerts.length > 0) {
    return analysis.alerts.slice(0, 4);
  }

  return analysis.rows
    .filter((row) => row.prediction !== "Normal")
    .slice(0, 4)
    .map((row) => ({
      id: row.rowId,
      title: row.prediction === "Attack" ? "Attack detected" : "Review recommended",
      severity: row.prediction === "Attack" ? "attack" : "suspicious",
      source: row.sourceIp || "Network source",
      route: row.service || "/upload-log",
      timestamp: formatDateTime(analysis.summary.updatedAt),
      detail: `${row.rowId} ${row.prediction.toLowerCase()} with ${row.attackProbability}% attack probability.`,
    }));
}

function hasUploadActivity(data: DashboardBackendData) {
  return data.distribution.some((segment) => segment.value > 0);
}

function hasBackendSummaryActivity(summary: BackendDashboardSummary) {
  return (
    summary.total_records > 0 ||
    summary.total_review_recommended > 0 ||
    summary.total_attacks > 0 ||
    summary.total_normal > 0
  );
}

function buildVisitorMetrics(summary: BackendDashboardSummary): SummaryMetric[] {
  if (
    summary.active_visitors === 0 &&
    summary.suspicious_visitors === 0 &&
    summary.total_requests_last_5_minutes === 0
  ) {
    return [];
  }

  return [
    {
      label: "Active Visitors",
      value: summary.active_visitors.toLocaleString(),
      helper: "Website visitors seen in the active window",
      tone: "info",
    },
    {
      label: "Flagged Visitors",
      value: summary.suspicious_visitors.toLocaleString(),
      helper: "Visitors breaching monitoring thresholds",
      tone: "suspicious",
    },
  ];
}

function mapTopRoutes(routes: BackendTopRoutesResponse): DashboardBackendData["topRoutes"] {
  return routes.items.map((route) => ({
    route: route.route,
    totalHits: route.request_count,
    suspiciousHits: route.suspicious_count,
    tone: route.suspicious_count >= 10 ? "attack" : route.suspicious_count > 0 ? "suspicious" : "info",
  }));
}

function mapLatestSelfTest(
  summary: BackendDashboardSummary,
): DashboardBackendData["latestSelfTest"] {
  if (!summary.latest_self_test_result) return null;

  return {
    label: summary.latest_self_test_result.result === "attack" ? "Attack" : "Normal",
    confidence: Math.round(clamp(summary.latest_self_test_result.confidence, 0, 1) * 100),
    score: Math.round(clamp(summary.latest_self_test_result.attack_probability, 0, 1) * 100),
    interpretation:
      summary.latest_self_test_result.result === "attack"
        ? "The latest prediction flagged the traffic pattern for security review."
        : "The latest prediction classified the traffic pattern as normal.",
    testedAt: formatDateTime(summary.latest_self_test_result.timestamp),
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
