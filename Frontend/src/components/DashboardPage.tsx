import { useEffect, useState } from "react";
import { fetchDashboardBackendData, type DashboardBackendData } from "../utils/dashboard";
import { AlertList } from "./AlertList";
import { EmptyState } from "./EmptyState";
import { LineChart } from "./LineChart";
import { Panel } from "./Panel";
import { PieChart } from "./PieChart";
import { PredictionResultCard } from "./PredictionResultCard";
import { RouteList } from "./RouteList";
import { SummaryCard } from "./SummaryCard";

export function DashboardPage() {
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

    fetchDashboardBackendData()
      .then((data) => {
        if (!active) {
          return;
        }
        setBackendData(data);
        setStatus({
          type: "success",
          message: data.metrics.some((metric) => metric.value !== "0" && metric.value !== "0.00%")
            ? "Backend summary refreshed successfully."
            : "No backend activity recorded yet.",
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setBackendData(null);
        setStatus({
          type: "error",
          message: "Dashboard summary is temporarily unavailable.",
        });
      });

    return () => {
      active = false;
    };
  }, []);

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

  return (
    <div className="page-grid">
      <div className="hero-note panel">
        <div>
          <p className="eyebrow">AI Security Operations</p>
          <h3>
            Unified view of uploaded analysis, visitor activity, alerts, and AI prediction results.
          </h3>
          <p className={`hero-note-copy inline-message-${status.type}`}>{status.message}</p>
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
        <Panel title="Normal vs flagged" subtitle="Uploaded result distribution for the latest analysis batch.">
          {distribution.some((segment) => segment.value > 0) ? (
            <PieChart
              centerLabel="Flagged"
              centerValue={flaggedCount.toLocaleString()}
              segments={distribution}
            />
          ) : (
            <EmptyState
              title="No backend activity recorded yet"
              description="Upload analysis distribution appears after the backend processes a dataset."
            />
          )}
        </Panel>

        <Panel title="Recent detections" subtitle="Detection counts over the latest monitoring window.">
          {trend.length > 0 ? (
            <LineChart
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
                  label: "Suspicious",
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
              description="Recent detection trends appear after upload analyses are processed."
            />
          )}
        </Panel>
      </div>

      <div className="dashboard-lower-grid">
        <Panel title="Recent alerts" subtitle="Latest alerts worth showing on the landing view.">
          {alerts.length > 0 ? (
            <AlertList alerts={alerts} />
          ) : (
            <EmptyState
              title="No backend activity recorded yet"
              description="Alerts will appear after uploads or visitor activity trigger backend rules."
            />
          )}
        </Panel>

        <div className="dashboard-side-stack">
          <Panel title="Visitor summary" subtitle="Current website activity snapshot, not full packet capture.">
            <div className="summary-grid compact-grid">
              {visitorMetrics.length > 0 ? (
                visitorMetrics.map((metric) => (
                  <SummaryCard key={metric.label} {...metric} />
                ))
              ) : (
                <EmptyState
                  title="No backend activity recorded yet"
                  description="Visitor metrics appear after backend request or page-view activity is recorded."
                />
              )}
            </div>
          </Panel>

          <Panel title="Suspicious routes" subtitle="Top routes drawing suspicious traffic or repeated probing.">
            {topRoutes.length > 0 ? (
              <RouteList routes={topRoutes} />
            ) : (
              <EmptyState
                title="No backend activity recorded yet"
                description="Route activity appears after FastAPI receives requests."
              />
            )}
          </Panel>

          <Panel title="Latest self-test" subtitle="Most recent manual prediction run from the self-test page.">
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
                description="Run a self-test prediction to populate this section."
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
