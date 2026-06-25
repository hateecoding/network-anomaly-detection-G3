import type {
  AlertRecord,
  DetectionTrendPoint,
  SummaryMetric,
} from "../data/presentationData";
import { requestJson } from "./api";

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
  const [summary, alerts, routes] = await Promise.all([
    requestJson<BackendDashboardSummary>("/dashboard-summary"),
    requestJson<BackendAlertsResponse>("/alerts?limit=4"),
    requestJson<BackendTopRoutesResponse>("/top-routes?limit=5"),
  ]);

  return {
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
    visitorMetrics: [
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
    ],
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
    topRoutes: routes.items.map((route) => ({
      route: route.route,
      totalHits: route.request_count,
      suspiciousHits: route.suspicious_count,
      tone: route.suspicious_count >= 10 ? "attack" : route.suspicious_count > 0 ? "suspicious" : "info",
    })),
    latestSelfTest: summary.latest_self_test_result
      ? {
          label: summary.latest_self_test_result.result === "attack" ? "Attack" : "Normal",
          confidence: Math.round(clamp(summary.latest_self_test_result.confidence, 0, 1) * 100),
          score: Math.round(clamp(summary.latest_self_test_result.attack_probability, 0, 1) * 100),
          interpretation:
            summary.latest_self_test_result.result === "attack"
              ? "The latest prediction flagged the traffic pattern for security review."
              : "The latest prediction classified the traffic pattern as normal.",
          testedAt: formatDateTime(summary.latest_self_test_result.timestamp),
        }
      : null,
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
