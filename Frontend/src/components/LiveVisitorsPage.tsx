import { useEffect, useState } from "react";
import { liveVisitorSnapshots } from "../data/presentationData";
import { BarChart } from "./BarChart";
import { DataColumn, DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";
import { RouteList } from "./RouteList";
import { SummaryCard } from "./SummaryCard";
import { VisitorTable } from "./VisitorTable";

type LiveVisitorsPageProps = {
  refreshNonce: number;
};

const suspiciousIpColumns: DataColumn<(typeof liveVisitorSnapshots)[number]["suspiciousIps"][number]>[] = [
  {
    key: "ip",
    header: "IP / route",
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
    header: "Reason",
    render: (row) => row.reason,
  },
  {
    key: "lastSeen",
    header: "Last seen",
    render: (row) => row.lastSeen,
  },
];

export function LiveVisitorsPage({ refreshNonce }: LiveVisitorsPageProps) {
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSnapshotIndex((value) => (value + 1) % liveVisitorSnapshots.length);
      setLastUpdatedAt(new Date());
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (refreshNonce === 0) {
      return;
    }
    setSnapshotIndex((value) => (value + 1) % liveVisitorSnapshots.length);
    setLastUpdatedAt(new Date());
  }, [refreshNonce]);

  const snapshot = liveVisitorSnapshots[snapshotIndex];

  return (
    <div className="page-grid">
      <Panel
        title="Visitor monitoring"
        subtitle="This page tracks traffic to your website and APIs. It is not doing full network packet capture."
      >
        <div className="hero-note-copy">
          The monitoring view refreshes current visitor metrics, suspicious request summaries,
          and route pressure for analyst review.
        </div>
        <div className="inline-meta">
          <span>Auto refresh every 5s</span>
          <span>Last update {formatTime(lastUpdatedAt)}</span>
        </div>
      </Panel>

      <div className="summary-grid">
        <SummaryCard
          label="Active visitors"
          value={snapshot.activeVisitors.toString()}
          helper="Distinct website visitors in the active window"
          tone="info"
        />
        <SummaryCard
          label="Suspicious visitors"
          value={snapshot.suspiciousVisitors.toString()}
          helper="Visitors currently breaching simple thresholds"
          tone="suspicious"
        />
        <SummaryCard
          label="Requests in 5 min"
          value={snapshot.totalRequestsLast5Minutes.toLocaleString()}
          helper="Recent website and API requests"
          tone="normal"
        />
      </div>

      <div className="analytics-grid">
        <Panel title="Top visited routes" subtitle="D3 route chart for the latest 5-minute window.">
          <BarChart
            data={snapshot.topRoutes.map((route) => ({
              label: route.route,
              value: route.totalHits,
              suffix: "",
              color:
                route.tone === "attack"
                  ? "#f97316"
                  : route.tone === "suspicious"
                    ? "#fbbf24"
                    : "#60a5fa",
            }))}
          />
        </Panel>

        <Panel title="Suspicious route list" subtitle="Routes with the highest suspicious hit count right now.">
          <RouteList routes={snapshot.topRoutes} />
        </Panel>
      </div>

      <div className="dashboard-lower-grid">
        <Panel title="Recent suspicious requests" subtitle="Suspicious request stream returned by the live visitors endpoint.">
          {snapshot.suspiciousRequests.length > 0 ? (
            <VisitorTable rows={snapshot.suspiciousRequests} />
          ) : (
            <EmptyState
              title="No suspicious requests"
              description="This area shows request bursts and suspicious route access when activity is detected."
            />
          )}
        </Panel>

        <div className="dashboard-side-stack">
          <Panel title="Top suspicious IPs" subtitle="Highest-pressure visitors in the current monitoring window.">
            <DataTable
              columns={suspiciousIpColumns}
              rows={snapshot.suspiciousIps}
              rowKey={(row) => row.id}
            />
          </Panel>

          <Panel title="Activity feed" subtitle="Latest visitor-related events from the monitoring service.">
            <div className="activity-feed">
              {snapshot.activityFeed.map((item) => (
                <article key={item.id} className="activity-feed-item">
                  <div className={`activity-dot activity-dot-${item.tone}`} />
                  <div>
                    <strong>{item.message}</strong>
                    <span>{item.timestamp}</span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
