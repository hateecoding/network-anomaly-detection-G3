import { useEffect, useState } from "react";
import {
  dashboardDistribution,
  dashboardMetrics,
  detectionTrend,
  latestSelfTest,
  recentAlerts,
  suspiciousRoutes,
  visitorSummaryMetrics,
} from "../data/presentationData";
import { fetchDashboardBackendData, type DashboardBackendData } from "../utils/dashboard";
import { AlertList } from "./AlertList";
import { LineChart } from "./LineChart";
import { Panel } from "./Panel";
import { PieChart } from "./PieChart";
import { PredictionResultCard } from "./PredictionResultCard";
import { RouteList } from "./RouteList";
import { SummaryCard } from "./SummaryCard";

export function DashboardPage() {
  const [backendData, setBackendData] = useState<DashboardBackendData | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading backend summary...");

  useEffect(() => {
    let active = true;

    fetchDashboardBackendData()
      .then((data) => {
        if (!active) {
          return;
        }
        setBackendData(data);
        setStatusMessage("Backend summary refreshed successfully.");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setStatusMessage("Dashboard summary is temporarily unavailable. Existing results remain visible.");
      });

    return () => {
      active = false;
    };
  }, []);

  const metrics = backendData?.metrics ?? dashboardMetrics;
  const visitorMetrics = backendData?.visitorMetrics ?? visitorSummaryMetrics;
  const distribution = backendData?.distribution ?? dashboardDistribution;
  const trend = backendData?.detectionTrend.length ? backendData.detectionTrend : detectionTrend;
  const alerts = backendData?.alerts.length ? backendData.alerts : recentAlerts.slice(0, 4);
  const selfTest = backendData?.latestSelfTest ?? latestSelfTest;
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
          <p className="hero-note-copy">{statusMessage}</p>
        </div>
      </div>

      <div className="summary-grid">
        {metrics.map((metric) => (
          <SummaryCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="analytics-grid">
        <Panel title="Normal vs flagged" subtitle="Uploaded result distribution for the latest analysis batch.">
          <PieChart
            centerLabel="Flagged"
            centerValue={flaggedCount.toLocaleString()}
            segments={distribution}
          />
        </Panel>

        <Panel title="Recent detections" subtitle="Detection counts over the latest monitoring window.">
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
        </Panel>
      </div>

      <div className="dashboard-lower-grid">
        <Panel title="Recent alerts" subtitle="Latest alerts worth showing on the landing view.">
          <AlertList alerts={alerts} />
        </Panel>

        <div className="dashboard-side-stack">
          <Panel title="Visitor summary" subtitle="Current website activity snapshot, not full packet capture.">
            <div className="summary-grid compact-grid">
              {visitorMetrics.map((metric) => (
                <SummaryCard key={metric.label} {...metric} />
              ))}
            </div>
          </Panel>

          <Panel title="Suspicious routes" subtitle="Top routes drawing suspicious traffic or repeated probing.">
            <RouteList routes={suspiciousRoutes} />
          </Panel>

          <Panel title="Latest self-test" subtitle="Most recent manual prediction run from the self-test page.">
            <PredictionResultCard
              confidence={selfTest.confidence}
              interpretation={selfTest.interpretation}
              label={selfTest.label}
              score={selfTest.score}
              testedAt={selfTest.testedAt}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
