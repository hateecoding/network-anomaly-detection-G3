import type { ActivityFeedItem, RouteStat, VisitorIdentifier, VisitorRequest } from "../data/presentationData";
import { requestJson } from "./api";

type BackendLiveActivityEvent = {
  timestamp: string;
  source_ip?: string | null;
  route: string;
  method: string;
  status_code: number;
  suspicious: boolean;
  reason?: string | null;
};

type BackendLiveVisitorsResponse = {
  generated_at: string;
  active_visitors: number;
  suspicious_visitors: number;
  total_requests_last_5_minutes: number;
  recent_suspicious_requests: BackendLiveActivityEvent[];
  latest_activity: BackendLiveActivityEvent[];
};

type BackendTopRoutesResponse = {
  generated_at: string;
  items: {
    route: string;
    request_count: number;
    suspicious_count: number;
  }[];
};

export type LiveTrafficData = {
  generatedAt: string;
  activeVisitors: number;
  suspiciousVisitors: number;
  totalRequestsLast5Minutes: number;
  topRoutes: RouteStat[];
  recentRequests: VisitorRequest[];
  suspiciousRequests: VisitorRequest[];
  visitorIdentifiers: VisitorIdentifier[];
  activityFeed: ActivityFeedItem[];
};

export async function fetchLiveTrafficData(): Promise<LiveTrafficData> {
  // These endpoints read backend runtime memory only; no upload cache or database is mixed into live activity.
  const [live, routes] = await Promise.all([
    requestJson<BackendLiveVisitorsResponse>("/live-visitors?limit=50"),
    requestJson<BackendTopRoutesResponse>("/top-routes?limit=10"),
  ]);

  return {
    generatedAt: live.generated_at,
    activeVisitors: live.active_visitors,
    suspiciousVisitors: live.suspicious_visitors,
    totalRequestsLast5Minutes: live.total_requests_last_5_minutes,
    topRoutes: routes.items.map((route) => ({
      route: route.route,
      totalHits: route.request_count,
      suspiciousHits: route.suspicious_count,
      tone: route.suspicious_count > 0 ? "suspicious" : "info",
    })),
    recentRequests: live.latest_activity.map(mapActivityToRequest),
    suspiciousRequests: live.recent_suspicious_requests.map(mapActivityToRequest),
    visitorIdentifiers: buildVisitorIdentifiers(live.latest_activity),
    activityFeed: live.latest_activity.slice(0, 12).map(mapActivityToFeedItem),
  };
}

export async function trackFrontendVisit(route: string) {
  // Sends only route/timestamp context; backend anonymizes the visitor identifier before storing it in memory.
  await requestJson<{ status: string }>("/track-visit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route,
      timestamp: new Date().toISOString(),
    }),
  });
}

function mapActivityToRequest(event: BackendLiveActivityEvent, index: number): VisitorRequest {
  const tone = event.suspicious
    ? "suspicious"
    : event.status_code >= 500
      ? "attack"
      : "normal";

  return {
    id: `${event.timestamp}-${event.route}-${event.source_ip ?? "unknown"}-${index}`,
    ip: event.source_ip || "visitor-unknown",
    route: event.route,
    method: event.method,
    timestamp: formatTime(event.timestamp),
    requests: 1,
    reason: event.reason || buildActivityReason(event),
    tone,
  };
}

function buildVisitorIdentifiers(events: BackendLiveActivityEvent[]): VisitorIdentifier[] {
  const grouped = events.reduce<Record<string, VisitorIdentifier & { lastSeenRaw: string }>>((accumulator, event) => {
    const id = event.source_ip || "visitor-unknown";
    const current = accumulator[id];
    const previousRequests = current?.requests ?? 0;

    accumulator[id] = {
      id,
      ip: id,
      route: event.route,
      requests: previousRequests + 1,
      lastSeen: formatTime(event.timestamp),
      lastSeenRaw: event.timestamp,
      reason: event.suspicious
        ? event.reason || "Flagged backend activity."
        : event.method === "VIEW"
          ? "Frontend page view."
          : "Backend request activity.",
    };

    return accumulator;
  }, {});

  return Object.values(grouped)
    .sort((left, right) => right.requests - left.requests || Date.parse(right.lastSeenRaw) - Date.parse(left.lastSeenRaw))
    .slice(0, 10)
    .map(({ lastSeenRaw, ...item }) => item);
}

function mapActivityToFeedItem(event: BackendLiveActivityEvent, index: number): ActivityFeedItem {
  const statusText = event.method === "VIEW" ? "viewed" : `returned ${event.status_code}`;

  return {
    id: `ACT-${index}-${event.timestamp}`,
    message: `${event.source_ip || "visitor-unknown"} ${statusText} ${event.route}`,
    timestamp: formatTime(event.timestamp),
    tone: event.suspicious ? "suspicious" : event.status_code >= 500 ? "attack" : "info",
  };
}

function buildActivityReason(event: BackendLiveActivityEvent) {
  if (event.method === "VIEW") {
    return "Frontend page activity.";
  }

  if (event.status_code >= 500) {
    return "Backend error response.";
  }

  if (event.status_code >= 400) {
    return "Backend request returned an error status.";
  }

  return "Backend request activity.";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
