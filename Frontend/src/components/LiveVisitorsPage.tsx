import { useEffect, useState } from "react";
import { SuspiciousVisitor } from "../data/presentationData";
import { fetchLiveTrafficData, type LiveTrafficData } from "../utils/liveVisitors";
import { BarChart } from "./BarChart";
import { DataColumn, DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { LoadingOverlay } from "./LoadingOverlay";
import { Panel } from "./Panel";
import { RouteList } from "./RouteList";
import { SummaryCard } from "./SummaryCard";
import { VisitorTable } from "./VisitorTable";

type LiveVisitorsPageProps = {
  refreshNonce: number;
};

const visitorColumns: DataColumn<SuspiciousVisitor>[] = [
  {
    key: "ip",
    header: "Visitor / route",
    render: (row) => (
      <div>
        <strong>{row.ip}</strong>
        <span>{row.route}</span>
      </div>
    ),
  },
  {
    key: "requests",
    header: "Requests",
    align: "right",
    render: (row) => row.requests,
  },
  {
    key: "reason",
    header: "Activity",
    render: (row) => row.reason,
  },
  {
    key: "lastSeen",
    header: "Last seen",
    render: (row) => row.lastSeen,
  },
];

export function LiveVisitorsPage({ refreshNonce }: LiveVisitorsPageProps) {
  const [traffic, setTraffic] = useState<LiveTrafficData | null>(null);
  const [status, setStatus] = useState<{
    type: "loading" | "success" | "error";
    message: string;
  }>({
    type: "loading",
    message: "Loading live traffic...",
  });

  useEffect(() => {
    let active = true;

    const loadTraffic = async (showLoading = false) => {
      if (showLoading) {
        setStatus({ type: "loading", message: "Loading live traffic..." });
      }

      try {
        const nextTraffic = await fetchLiveTrafficData();
        if (!active) {
          return;
        }
        setTraffic(nextTraffic);
        setStatus({
          type: "success",
          message: "Live backend activity refreshed.",
        });
      } catch {
        if (!active) {
          return;
        }
        setStatus({
          type: "error",
          message: "Unable to load live traffic. Please try again.",
        });
      }
    };

    loadTraffic(true);
    const timer = window.setInterval(() => loadTraffic(false), 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshNonce]);

  const hasActivity = Boolean(traffic && traffic.totalRequestsLast5Minutes > 0);

  return (
    <div className="page-grid">
      <Panel
        title="Backend activity monitoring"
        subtitle="This page tracks requests reaching the FastAPI backend and frontend page-view pings. It is not full Amplify visitor analytics or packet capture."
      >
        <div className="hero-note-copy">
          Activity refreshes from the deployed backend every 5 seconds using the live visitors and top routes endpoints.
        </div>
        <div className="inline-meta">
          <span>Auto refresh every 5s</span>
          <span>{status.message}</span>
          <span>Last update {traffic ? formatTimestamp(traffic.generatedAt) : "Not available"}</span>
        </div>
      </Panel>

      <div className="summary-grid">
        <SummaryCard
          label="Active visitors"
          value={(traffic?.activeVisitors ?? 0).toLocaleString()}
          helper="Distinct backend visitors in the active window"
          tone="info"
        />
        <SummaryCard
          label="Suspicious visitors"
          value={(traffic?.suspiciousVisitors ?? 0).toLocaleString()}
          helper="Visitors breaching backend monitoring thresholds"
          tone="suspicious"
        />
        <SummaryCard
          label="Requests in 5 min"
          value={(traffic?.totalRequestsLast5Minutes ?? 0).toLocaleString()}
          helper="Recent FastAPI requests and tracked page views"
          tone="normal"
        />
      </div>

      <div className="analytics-grid">
        <Panel title="Top backend routes" subtitle="Request volume by route in the latest 5-minute backend window.">
          {traffic && traffic.topRoutes.length > 0 ? (
            <BarChart
              data={traffic.topRoutes.map((route) => ({
                label: route.route,
                value: route.totalHits,
                suffix: "",
                color: route.suspiciousHits > 0 ? "#fbbf24" : "#60a5fa",
              }))}
            />
          ) : (
            <EmptyState
              title="No live backend activity recorded yet"
              description="Routes will appear here after the backend receives requests or page-view pings."
            />
          )}
        </Panel>

        <Panel title="Route pressure" subtitle="Routes with total request counts and flagged activity from the backend tracker.">
          {traffic && traffic.topRoutes.length > 0 ? (
            <RouteList routes={traffic.topRoutes} />
          ) : (
            <EmptyState
              title="No route pressure yet"
              description="Route pressure appears when FastAPI records recent request activity."
            />
          )}
        </Panel>
      </div>

      <div className="dashboard-lower-grid">
        <Panel title="Recent backend requests" subtitle="Latest FastAPI requests and frontend page-view pings in the active window.">
          <div className="panel-table-wrap">
            {status.type === "loading" ? <LoadingOverlay message="Loading live traffic..." /> : null}
            {traffic && traffic.recentRequests.length > 0 ? (
              <VisitorTable rows={traffic.recentRequests} />
            ) : (
              <EmptyState
                title={status.type === "error" ? "Unable to load live traffic. Please try again." : "No live backend activity recorded yet"}
                description={status.type === "error" ? "The monitoring endpoint is currently unavailable." : "Open pages or call backend endpoints to populate this activity stream."}
              />
            )}
          </div>
        </Panel>

        <div className="dashboard-side-stack">
          <Panel title="Visitor identifiers" subtitle="Anonymized frontend visitors or backend source identifiers seen recently.">
            {traffic && traffic.visitorIdentifiers.length > 0 ? (
              <DataTable
                columns={visitorColumns}
                rows={traffic.visitorIdentifiers}
                rowKey={(row) => row.id}
              />
            ) : (
              <EmptyState
                title="No recent visitor identifiers"
                description="Identifiers appear after FastAPI records request or page-view activity."
              />
            )}
          </Panel>

          <Panel title="Suspicious request stream" subtitle="Recent requests flagged by the backend monitoring rules.">
            {traffic && traffic.suspiciousRequests.length > 0 ? (
              <VisitorTable rows={traffic.suspiciousRequests} />
            ) : (
              <EmptyState
                title="No suspicious requests"
                description={hasActivity ? "Recent activity is currently below suspicious thresholds." : "Suspicious requests appear when backend thresholds are breached."}
              />
            )}
          </Panel>

          <Panel title="Activity feed" subtitle="Latest live activity returned by the monitoring service.">
            {traffic && traffic.activityFeed.length > 0 ? (
              <div className="activity-feed">
                {traffic.activityFeed.map((item) => (
                  <article key={item.id} className="activity-feed-item">
                    <div className={`activity-dot activity-dot-${item.tone}`} />
                    <div>
                      <strong>{item.message}</strong>
                      <span>{item.timestamp}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No activity feed yet"
                description="Live backend activity will appear here as soon as requests are recorded."
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
