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

export const emptyUploadStateMessage =
  "Upload a CSV file to run AI analysis and populate the results table.";
