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
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  service: string;
  duration: number;
  prediction: "Normal" | "Suspicious" | "Attack";
  confidence: number;
  alertLevel: "Low" | "Medium" | "High";
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

export type LiveVisitorSnapshot = {
  activeVisitors: number;
  suspiciousVisitors: number;
  totalRequestsLast5Minutes: number;
  topRoutes: RouteStat[];
  suspiciousIps: SuspiciousVisitor[];
  suspiciousRequests: VisitorRequest[];
  activityFeed: ActivityFeedItem[];
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

export const sampleUploadRows: UploadAnalysisRow[] = [
  {
    rowId: "ROW-001",
    sourceIp: "203.0.113.41",
    destinationIp: "10.0.0.12",
    protocol: "TCP",
    service: "http",
    duration: 42,
    prediction: "Normal",
    confidence: 88,
    alertLevel: "Low",
  },
  {
    rowId: "ROW-002",
    sourceIp: "198.51.100.8",
    destinationIp: "10.0.0.19",
    protocol: "TCP",
    service: "ssh",
    duration: 133,
    prediction: "Attack",
    confidence: 96,
    alertLevel: "High",
  },
  {
    rowId: "ROW-003",
    sourceIp: "203.0.113.14",
    destinationIp: "10.0.0.17",
    protocol: "UDP",
    service: "dns",
    duration: 27,
    prediction: "Suspicious",
    confidence: 74,
    alertLevel: "Medium",
  },
  {
    rowId: "ROW-004",
    sourceIp: "192.0.2.19",
    destinationIp: "10.0.0.33",
    protocol: "ICMP",
    service: "icmp",
    duration: 88,
    prediction: "Attack",
    confidence: 91,
    alertLevel: "High",
  },
];

export const liveVisitorSnapshots: LiveVisitorSnapshot[] = [
  {
    activeVisitors: 64,
    suspiciousVisitors: 6,
    totalRequestsLast5Minutes: 1840,
    topRoutes: [
      { route: "/pricing", totalHits: 442, suspiciousHits: 6, tone: "info" },
      { route: "/checkout", totalHits: 311, suspiciousHits: 27, tone: "suspicious" },
      { route: "/docs", totalHits: 298, suspiciousHits: 3, tone: "normal" },
      { route: "/admin/login", totalHits: 164, suspiciousHits: 41, tone: "attack" },
    ],
    suspiciousIps: [
      {
        id: "VIS-01",
        ip: "203.0.113.41",
        route: "/checkout",
        requests: 91,
        lastSeen: "10:25",
        reason: "Burst traffic in short window",
      },
      {
        id: "VIS-02",
        ip: "198.51.100.8",
        route: "/admin/login",
        requests: 64,
        lastSeen: "10:24",
        reason: "Repeated denied admin access",
      },
      {
        id: "VIS-03",
        ip: "192.0.2.44",
        route: "/api/auth",
        requests: 38,
        lastSeen: "10:23",
        reason: "Repeated auth probing",
      },
    ],
    suspiciousRequests: [
      {
        id: "REQ-1001",
        ip: "203.0.113.41",
        route: "/checkout",
        method: "POST",
        timestamp: "10:25:14",
        requests: 91,
        reason: "Request burst",
        tone: "suspicious",
      },
      {
        id: "REQ-1002",
        ip: "198.51.100.8",
        route: "/admin/login",
        method: "POST",
        timestamp: "10:24:42",
        requests: 64,
        reason: "Credential stuffing pattern",
        tone: "attack",
      },
      {
        id: "REQ-1003",
        ip: "192.0.2.44",
        route: "/api/auth",
        method: "GET",
        timestamp: "10:24:09",
        requests: 38,
        reason: "High-frequency auth hits",
        tone: "suspicious",
      },
    ],
    activityFeed: [
      { id: "ACT-1", message: "Visitor 203.0.113.41 triggered checkout spike threshold.", timestamp: "10:25", tone: "suspicious" },
      { id: "ACT-2", message: "New upload analysis finished with 318 suspicious rows.", timestamp: "10:23", tone: "info" },
      { id: "ACT-3", message: "Admin route burst escalated to attack severity.", timestamp: "10:21", tone: "attack" },
    ],
  },
  {
    activeVisitors: 58,
    suspiciousVisitors: 4,
    totalRequestsLast5Minutes: 1652,
    topRoutes: [
      { route: "/pricing", totalHits: 401, suspiciousHits: 5, tone: "info" },
      { route: "/checkout", totalHits: 286, suspiciousHits: 18, tone: "suspicious" },
      { route: "/docs", totalHits: 319, suspiciousHits: 2, tone: "normal" },
      { route: "/admin/login", totalHits: 133, suspiciousHits: 26, tone: "attack" },
    ],
    suspiciousIps: [
      {
        id: "VIS-04",
        ip: "203.0.113.77",
        route: "/admin/login",
        requests: 52,
        lastSeen: "10:30",
        reason: "Repeated admin attempts",
      },
      {
        id: "VIS-05",
        ip: "198.51.100.12",
        route: "/checkout",
        requests: 34,
        lastSeen: "10:29",
        reason: "Request spike from single client",
      },
    ],
    suspiciousRequests: [
      {
        id: "REQ-1011",
        ip: "203.0.113.77",
        route: "/admin/login",
        method: "POST",
        timestamp: "10:30:11",
        requests: 52,
        reason: "Brute-force pattern",
        tone: "attack",
      },
      {
        id: "REQ-1012",
        ip: "198.51.100.12",
        route: "/checkout",
        method: "GET",
        timestamp: "10:29:39",
        requests: 34,
        reason: "High request frequency",
        tone: "suspicious",
      },
    ],
    activityFeed: [
      { id: "ACT-4", message: "Auto-refresh pulled a lower suspicious visitor count.", timestamp: "10:30", tone: "info" },
      { id: "ACT-5", message: "Checkout route returned to warning-only status.", timestamp: "10:29", tone: "suspicious" },
      { id: "ACT-6", message: "Admin route still shows attack-like request pattern.", timestamp: "10:28", tone: "attack" },
    ],
  },
];

export const emptyUploadStateMessage =
  "Upload a CSV file to preview how the frontend will render analyzed results from the backend.";
