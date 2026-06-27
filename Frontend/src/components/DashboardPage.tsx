import { useEffect, useState } from "react";
import { loadDashboardBackendData, type DashboardBackendData } from "../utils/dashboard";
import { STANDARD_SYNC_INTERVAL_MS, type SyncCallbacks } from "../utils/sync";
import { AlertList } from "./AlertList";
import { LineChart as D3LineChart } from "./LineChart";
import { PieChart as D3PieChart } from "./PieChart";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";
import { PredictionResultCard } from "./PredictionResultCard";
import { RouteList } from "./RouteList";
import { SummaryCard } from "./SummaryCard";

type DashboardPageProps = SyncCallbacks & {
  refreshNonce: number;
};

export function DashboardPage({
  refreshNonce,
  onSyncSuccess,
  onSyncFailure,
}: DashboardPageProps) {
  const [backendData, setBackendData] = useState<DashboardBackendData | null>(null);
  const [status, setStatus] = useState<{
    type: "loading" | "success" | "error";
    message: string;
  }>({
    type: "loading",
    message: "Loading backend summary...",
  });

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    const loadDashboard = async () => {
      if (requestInFlight) {
        return;
      }
      requestInFlight = true;

      try {
        // loadDashboardBackendData applies the backend-first, local-cache-second dashboard policy.
        const data = await loadDashboardBackendData();
        if (!active) {
          return;
        }
        setBackendData(data);
        setStatus({
          type: "success",
          message: data.sourceMessage,
        });
        if (data.source === "backend") {
          onSyncSuccess(data.sourceTimestamp ? new Date(data.sourceTimestamp) : undefined);
        }
      } catch {
        if (!active) {
          return;
        }
        setStatus({
          type: "error",
          message: "Dashboard sync failed. Existing data remains available.",
        });
        onSyncFailure();
      } finally {
        requestInFlight = false;
      }
    };

    void loadDashboard();
    // Standard pages refresh less aggressively than Live Visitors to avoid unnecessary backend pressure.
    const timer = window.setInterval(() => void loadDashboard(), STANDARD_SYNC_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshNonce, onSyncFailure, onSyncSuccess]);

  const metrics = backendData?.metrics ?? [];
  const visitorMetrics = backendData?.visitorMetrics ?? [];
  const distribution = backendData?.distribution ?? [];
  const trend = backendData?.detectionTrend ?? [];
  const alerts = backendData?.alerts ?? [];
  const selfTest = backendData?.latestSelfTest ?? null;
  const topRoutes = backendData?.topRoutes ?? [];
  const flaggedCount = distribution
    .filter((segment) => segment.label !== "Normal")
    .reduce((total, segment) => total + segment.value, 0);
  const sourceNotice = backendData?.source === "cache"
    ? "Showing latest locally cached upload analysis."
    : null;

  return (
    <div className="page-grid dashboard-page">
      <div className="hero-note panel">
        <div>
          <p className="eyebrow">AI Security Operations</p>
          <h3>Security overview</h3>
          <p className={`hero-note-copy inline-message-${status.type}`}>{status.message}</p>
          {sourceNotice ? <p className="inline-meta">{sourceNotice}</p> : null}
        </div>
      </div>

      <div className="summary-grid">
        {metrics.length > 0 ? (
          metrics.map((metric) => (
            <SummaryCard key={metric.label} {...metric} />
          ))
        ) : (
          <EmptyState
            title="No backend activity recorded yet"
            description="Dashboard metrics will appear after uploads, predictions, or visitor events are recorded."
          />
        )}
      </div>

      <div className="analytics-grid">
        <Panel title="Normal vs flagged" subtitle="Latest upload distribution.">
          {distribution.some((segment) => segment.value > 0) ? (
            <D3PieChart
              centerLabel="Flagged"
              centerValue={flaggedCount.toLocaleString()}
              segments={distribution}
            />
          ) : (
            <EmptyState
              title="No backend activity recorded yet"
              description="Run an upload analysis to populate this chart."
            />
          )}
        </Panel>

        <Panel title="Recent detections" subtitle="Backend detection history.">
          {trend.length > 0 ? (
            <D3LineChart
              series={[
                {
                  key: "normal",
                  label: "Normal",
                  color: "#34d399",
                  values: trend.map((item) => ({
                    label: item.label,
                    value: item.normal,
                  })),
                },
                {
                  key: "suspicious",
                  label: "Review Recommended",
                  color: "#fbbf24",
                  values: trend.map((item) => ({
                    label: item.label,
                    value: item.suspicious,
                  })),
                },
                {
                  key: "attack",
                  label: "Attack",
                  color: "#f97316",
                  values: trend.map((item) => ({
                    label: item.label,
                    value: item.attack,
                  })),
                },
              ]}
            />
          ) : (
            <EmptyState
              title="No backend activity recorded yet"
              description="Detection history appears after upload analyses."
            />
          )}
        </Panel>
      </div>

      <div className="dashboard-lower-grid">
        <Panel title="Recent alerts">
          {alerts.length > 0 ? (
            <AlertList alerts={alerts} />
          ) : (
            <EmptyState
              title="No backend activity recorded yet"
              description="Alerts appear after backend rules are triggered."
            />
          )}
        </Panel>

        <div className="dashboard-side-stack">
          <Panel title="Visitor summary">
            <div className="summary-grid compact-grid">
              {visitorMetrics.length > 0 ? (
                visitorMetrics.map((metric) => (
                  <SummaryCard key={metric.label} {...metric} />
                ))
              ) : (
                <EmptyState
                  title="No backend activity recorded yet"
                  description="Visitor metrics appear after backend activity."
                />
              )}
            </div>
          </Panel>

          <Panel title="Top routes">
            {topRoutes.length > 0 ? (
              <RouteList routes={topRoutes} />
            ) : (
              <EmptyState
                title="No backend activity recorded yet"
                description="Route activity appears after backend requests."
              />
            )}
          </Panel>

          <Panel title="Latest self-test">
            {selfTest ? (
              <PredictionResultCard
                confidence={selfTest.confidence}
                interpretation={selfTest.interpretation}
                label={selfTest.label}
                score={selfTest.score}
                testedAt={selfTest.testedAt}
              />
            ) : (
              <EmptyState
                title="No backend prediction recorded yet"
                description="Run a self-test prediction to populate this card."
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
