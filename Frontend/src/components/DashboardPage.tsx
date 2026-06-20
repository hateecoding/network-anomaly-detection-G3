import {
  dashboardDistribution,
  dashboardMetrics,
  detectionTrend,
  latestSelfTest,
  recentAlerts,
  suspiciousRoutes,
  visitorSummaryMetrics,
} from "../data/mockData";
import { AlertList } from "./AlertList";
import { LineChart } from "./LineChart";
import { Panel } from "./Panel";
import { PieChart } from "./PieChart";
import { PredictionResultCard } from "./PredictionResultCard";
import { RouteList } from "./RouteList";
import { SummaryCard } from "./SummaryCard";

export function DashboardPage() {
  return (
    <div className="page-grid">
      <div className="hero-note panel">
        <div>
          <p className="eyebrow">Frontend Scope</p>
          <h3>
            This dashboard is the visual layer. It should render backend results, uploaded analysis,
            visitor activity, and manual self-tests without overwhelming the user.
          </h3>
        </div>
      </div>

      <div className="summary-grid">
        {dashboardMetrics.map((metric) => (
          <SummaryCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="analytics-grid">
        <Panel title="Normal vs flagged" subtitle="Uploaded result distribution for the latest analysis batch.">
          <PieChart
            centerLabel="Flagged"
            centerValue="633"
            segments={dashboardDistribution}
          />
        </Panel>

        <Panel title="Recent detections" subtitle="Detection counts over the latest monitoring window.">
          <LineChart
            series={[
              {
                key: "normal",
                label: "Normal",
                color: "#34d399",
                values: detectionTrend.map((item) => ({
                  label: item.label,
                  value: item.normal,
                })),
              },
              {
                key: "suspicious",
                label: "Suspicious",
                color: "#fbbf24",
                values: detectionTrend.map((item) => ({
                  label: item.label,
                  value: item.suspicious,
                })),
              },
              {
                key: "attack",
                label: "Attack",
                color: "#f97316",
                values: detectionTrend.map((item) => ({
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
          <AlertList alerts={recentAlerts.slice(0, 4)} />
        </Panel>

        <div className="dashboard-side-stack">
          <Panel title="Visitor summary" subtitle="Current website activity snapshot, not full packet capture.">
            <div className="summary-grid compact-grid">
              {visitorSummaryMetrics.map((metric) => (
                <SummaryCard key={metric.label} {...metric} />
              ))}
            </div>
          </Panel>

          <Panel title="Suspicious routes" subtitle="Top routes drawing suspicious traffic or repeated probing.">
            <RouteList routes={suspiciousRoutes} />
          </Panel>

          <Panel title="Latest self-test" subtitle="Most recent manual prediction run from the self-test page.">
            <PredictionResultCard
              confidence={latestSelfTest.confidence}
              interpretation={latestSelfTest.interpretation}
              label={latestSelfTest.label}
              score={latestSelfTest.score}
              testedAt={latestSelfTest.testedAt}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
