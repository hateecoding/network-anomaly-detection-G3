from __future__ import annotations

from collections import Counter, deque
from datetime import datetime, timedelta, timezone
import hashlib
from threading import Lock

from fastapi import Request

from schemas import (
    AlertRecord,
    LiveActivityEvent,
    LiveVisitorsResponse,
    TopRouteEntry,
    TopRoutesResponse,
)

ACTIVE_WINDOW = timedelta(minutes=5)
RETENTION_WINDOW = timedelta(minutes=15)
BURST_WINDOW = timedelta(seconds=60)
BURST_THRESHOLD = 20
FAILED_REQUEST_THRESHOLD = 5
SENSITIVE_ROUTE_THRESHOLD = 3

IGNORED_PATHS = {
    "/health",
    "/dashboard-summary",
    "/alerts",
    "/live-visitors",
    "/top-routes",
    "/track-visit",
}
IGNORED_PREFIXES = ("/docs", "/redoc", "/openapi.json")
SENSITIVE_ROUTE_KEYWORDS = (
    "admin",
    "login",
    "config",
    ".env",
    "wp-",
    "phpmyadmin",
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _extract_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def _anonymize_visitor(request: Request) -> str:
    # Hash request context so Live Visitors can count activity without storing raw personal identifiers.
    raw_identity = "|".join(
        [
            _extract_client_ip(request),
            request.headers.get("user-agent", ""),
            request.headers.get("accept-language", ""),
        ]
    )
    digest = hashlib.sha256(raw_identity.encode("utf-8")).hexdigest()[:12]
    return f"visitor-{digest}"


def _normalize_frontend_route(route: str) -> str:
    cleaned = route.strip()[:160] or "/"
    if cleaned.startswith("#"):
        cleaned = cleaned[1:]
    if not cleaned.startswith("/"):
        cleaned = f"/{cleaned}"
    return cleaned


class VisitorTracker:
    def __init__(self):
        # Bounded in-memory storage keeps App Runner runtime monitoring lightweight and non-persistent.
        self._events: deque[dict[str, object]] = deque(maxlen=5000)
        self._lock = Lock()

    def _should_ignore(self, request: Request) -> bool:
        path = request.url.path
        if request.method.upper() == "OPTIONS":
            return True
        if path in IGNORED_PATHS:
            return True
        return any(path.startswith(prefix) for prefix in IGNORED_PREFIXES)

    def _prune(self, now: datetime) -> None:
        while self._events and now - self._events[0]["timestamp"] > RETENTION_WINDOW:
            self._events.popleft()

    def _build_suspicion(self, ip: str, path: str, status_code: int, now: datetime):
        burst_count = 0
        recent_failures = 0
        sensitive_hits = 0

        for event in self._events:
            if event["ip"] != ip:
                continue
            if now - event["timestamp"] > BURST_WINDOW:
                continue

            burst_count += 1
            if event["status_code"] >= 400:
                recent_failures += 1
            if any(keyword in str(event["path"]).lower() for keyword in SENSITIVE_ROUTE_KEYWORDS):
                sensitive_hits += 1

        if burst_count + 1 >= BURST_THRESHOLD:
            return True, "Request burst detected from the same client."
        if status_code >= 400 and recent_failures + 1 >= FAILED_REQUEST_THRESHOLD:
            return True, "Repeated failed requests from the same client."
        if any(keyword in path.lower() for keyword in SENSITIVE_ROUTE_KEYWORDS):
            if sensitive_hits + 1 >= SENSITIVE_ROUTE_THRESHOLD:
                return True, "Repeated access to a sensitive route."

        return False, None

    def record_request(self, request: Request, status_code: int) -> None:
        if self._should_ignore(request):
            return

        now = utcnow()
        path = request.url.path
        ip = _extract_client_ip(request)

        with self._lock:
            self._prune(now)
            suspicious, reason = self._build_suspicion(ip, path, status_code, now)
            self._events.append(
                {
                    "timestamp": now,
                    "ip": ip,
                    "path": path,
                    "method": request.method.upper(),
                    "status_code": status_code,
                    "suspicious": suspicious,
                    "reason": reason,
                }
            )

    def record_frontend_visit(self, request: Request, route: str) -> None:
        # Frontend pings are treated as page-view activity, separate from raw backend route requests.
        now = utcnow()
        path = _normalize_frontend_route(route)
        visitor_id = _anonymize_visitor(request)

        with self._lock:
            self._prune(now)
            self._events.append(
                {
                    "timestamp": now,
                    "ip": visitor_id,
                    "path": path,
                    "method": "VIEW",
                    "status_code": 200,
                    "suspicious": False,
                    "reason": "Frontend page activity recorded.",
                }
            )

    def _recent_events(self) -> list[dict[str, object]]:
        now = utcnow()
        with self._lock:
            self._prune(now)
            return [
                event
                for event in self._events
                if now - event["timestamp"] <= ACTIVE_WINDOW
            ]

    def _to_live_activity_event(self, event: dict[str, object]) -> LiveActivityEvent:
        return LiveActivityEvent(
            timestamp=event["timestamp"],
            source_ip=event["ip"],
            route=event["path"],
            method=event["method"],
            status_code=event["status_code"],
            suspicious=event["suspicious"],
            reason=event["reason"],
        )

    def get_live_visitors(self, limit: int = 20) -> LiveVisitorsResponse:
        recent_events = self._recent_events()
        active_visitors = {event["ip"] for event in recent_events}
        suspicious_visitors = {
            event["ip"] for event in recent_events if event["suspicious"]
        }
        suspicious_events = [
            self._to_live_activity_event(event)
            for event in reversed(recent_events)
            if event["suspicious"]
        ][:limit]
        latest_activity = [
            self._to_live_activity_event(event) for event in reversed(recent_events)
        ][:limit]

        return LiveVisitorsResponse(
            generated_at=utcnow(),
            active_visitors=len(active_visitors),
            suspicious_visitors=len(suspicious_visitors),
            total_requests_last_5_minutes=len(recent_events),
            recent_suspicious_requests=suspicious_events,
            latest_activity=latest_activity,
        )

    def get_top_routes(self, limit: int = 10) -> TopRoutesResponse:
        recent_events = self._recent_events()
        route_counts = Counter()
        suspicious_counts = Counter()

        for event in recent_events:
            route = str(event["path"])
            route_counts[route] += 1
            if event["suspicious"]:
                suspicious_counts[route] += 1

        items = [
            TopRouteEntry(
                route=route,
                request_count=count,
                suspicious_count=suspicious_counts[route],
            )
            for route, count in route_counts.most_common(limit)
        ]

        return TopRoutesResponse(generated_at=utcnow(), items=items)

    def get_suspicious_alerts(self, limit: int = 25) -> list[AlertRecord]:
        recent_events = self._recent_events()
        alerts: list[AlertRecord] = []

        for event in reversed(recent_events):
            if not event["suspicious"]:
                continue
            alerts.append(
                AlertRecord(
                    alert_type="visitor",
                    created_at=event["timestamp"],
                    message=str(event["reason"] or "Flagged visitor activity detected."),
                    alert_level="medium",
                    source_ip=event["ip"],
                    route=event["path"],
                )
            )
            if len(alerts) >= limit:
                break

        return alerts

    def get_recent_suspicious_count(self) -> int:
        recent_events = self._recent_events()
        return sum(1 for event in recent_events if event["suspicious"])


visitor_tracker = VisitorTracker()
