export type Tone = "normal" | "suspicious" | "attack" | "info";

export type SummaryMetric = {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
};

export type AlertRecord = {
  id: string;
  title: string;
  severity: Exclude<Tone, "normal">;
  source: string;
  route: string;
  timestamp: string;
  detail: string;
};

export type DetectionTrendPoint = {
  label: string;
  normal: number;
  suspicious: number;
  attack: number;
};

export type RouteStat = {
  route: string;
  totalHits: number;
  suspiciousHits: number;
  tone: Tone;
};

export type UploadAnalysisRow = {
  rowId: string;
  recordNumber: number;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  service: string;
  duration: number;
  prediction: "Normal" | "Suspicious" | "Attack";
  confidence: number;
  attackProbability: number;
  alertLevel: "Low" | "Medium" | "High";
  detectionResult: "SAFE" | "THREAT DETECTED";
};

export type SuspiciousVisitor = {
  id: string;
  ip: string;
  route: string;
  requests: number;
  lastSeen: string;
  reason: string;
};

export type VisitorRequest = {
  id: string;
  ip: string;
  route: string;
  method: string;
  timestamp: string;
  requests: number;
  reason: string;
  tone: Exclude<Tone, "info">;
};

export type ActivityFeedItem = {
  id: string;
  message: string;
  timestamp: string;
  tone: Tone;
};

export type SelfTestPreview = {
  label: "Normal" | "Suspicious" | "Attack";
  confidence: number;
  score: number;
  interpretation: string;
  testedAt: string;
};

export const dashboardMetrics: SummaryMetric[] = [
  {
    label: "Uploaded Records",
    value: "24,874",
    helper: "Rows processed in the latest analysis set",
    tone: "info",
  },
  {
    label: "Suspicious Records",
    value: "318",
    helper: "Rows flagged for review or escalation",
    tone: "suspicious",
  },
  {
    label: "Normal Records",
    value: "24,241",
    helper: "Rows classified as normal traffic",
    tone: "normal",
  },
  {
    label: "Attack Percentage",
    value: "1.27%",
    helper: "High-confidence attack labels in the latest run",
    tone: "attack",
  },
];

export const visitorSummaryMetrics: SummaryMetric[] = [
  {
    label: "Active Visitors",
    value: "64",
    helper: "Website visitors seen in the current window",
    tone: "info",
  },
  {
    label: "Suspicious Visitors",
    value: "6",
    helper: "Visitors breaching simple rule thresholds",
    tone: "suspicious",
  },
];

export const dashboardDistribution = [
  {
    label: "Normal",
    value: 24241,
    tone: "info" as const,
    color: "#34d399",
  },
  {
    label: "Suspicious",
    value: 318,
    tone: "suspicious" as const,
    color: "#fbbf24",
  },
  {
    label: "Attack",
    value: 315,
    tone: "attack" as const,
    color: "#f97316",
  },
];

export const detectionTrend: DetectionTrendPoint[] = [
  { label: "09:00", normal: 580, suspicious: 14, attack: 5 },
  { label: "10:00", normal: 610, suspicious: 19, attack: 7 },
  { label: "11:00", normal: 640, suspicious: 22, attack: 8 },
  { label: "12:00", normal: 590, suspicious: 18, attack: 6 },
  { label: "13:00", normal: 660, suspicious: 24, attack: 9 },
  { label: "14:00", normal: 625, suspicious: 21, attack: 8 },
  { label: "15:00", normal: 648, suspicious: 26, attack: 11 },
];

export const recentAlerts: AlertRecord[] = [
  {
    id: "ALT-021",
    title: "Port scanning burst detected",
    severity: "attack",
    source: "10.0.8.94",
    route: "/admin/login",
    timestamp: "2026-04-01 08:42",
    detail: "Repeated access attempts across 23 ports within 90 seconds.",
  },
  {
    id: "ALT-022",
    title: "Repeated checkout probe burst",
    severity: "suspicious",
    source: "203.0.113.41",
    route: "/checkout",
    timestamp: "2026-04-01 08:15",
    detail: "Single visitor generated 91 requests in 2 minutes against the checkout path.",
  },
  {
    id: "ALT-023",
    title: "Admin route denied repeatedly",
    severity: "suspicious",
    source: "198.51.100.8",
    route: "/wp-admin",
    timestamp: "2026-04-01 07:58",
    detail: "Failed access pattern suggests automated admin panel enumeration.",
  },
  {
    id: "ALT-024",
    title: "Self-test returned suspicious",
    severity: "info",
    source: "Analyst Console",
    route: "/predict",
    timestamp: "2026-04-01 07:44",
    detail: "Latest manual self-test scored above the suspicious threshold.",
  },
  {
    id: "ALT-025",
    title: "Credential abuse pattern flagged",
    severity: "attack",
    source: "192.168.3.20",
    route: "/auth",
    timestamp: "2026-04-01 07:41",
    detail: "Five failed logins followed by privileged access success.",
  },
];

export const suspiciousRoutes: RouteStat[] = [
  { route: "/admin/login", totalHits: 138, suspiciousHits: 44, tone: "attack" },
  { route: "/checkout", totalHits: 242, suspiciousHits: 31, tone: "suspicious" },
  { route: "/wp-admin", totalHits: 77, suspiciousHits: 26, tone: "suspicious" },
  { route: "/api/auth", totalHits: 153, suspiciousHits: 19, tone: "info" },
];

export const latestSelfTest: SelfTestPreview = {
  label: "Suspicious",
  confidence: 82,
  score: 57,
  interpretation: "The last manual test showed elevated login and packet-rate indicators that deserve review.",
  testedAt: "Apr 02, 10:24",
};

export const emptyUploadStateMessage =
  "Upload a CSV file to run AI analysis and populate the results table.";
