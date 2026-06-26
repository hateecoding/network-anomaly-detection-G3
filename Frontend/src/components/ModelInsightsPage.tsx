import { useEffect, useState } from "react";
import {
  fetchModelInsights,
  formatMetricPercent,
  formatModelName,
  ModelInsightItem,
  ModelInsightsData,
  ModelMetricName,
} from "../utils/modelInsights";
import { STANDARD_SYNC_INTERVAL_MS, type SyncCallbacks } from "../utils/sync";
import { BarChart as D3BarChart } from "./BarChart";
import { DataColumn, DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { LoadingOverlay } from "./LoadingOverlay";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { SummaryCard } from "./SummaryCard";

const metricColumns: DataColumn<ModelInsightItem>[] = [
  {
    key: "model",
    header: "Model",
    render: (row) => (
      <div>
        <strong>{formatModelName(row.modelName)}</strong>
        <span>{row.recommended ? "Recommended model" : "Available model"}</span>
      </div>
    ),
  },
  {
    key: "accuracy",
    header: "Accuracy",
    align: "right",
    render: (row) => formatMetricPercent(row.metrics.accuracy),
  },
  {
    key: "precision",
    header: "Precision",
    align: "right",
    render: (row) => formatMetricPercent(row.metrics.precision),
  },
  {
    key: "recall",
    header: "Recall",
    align: "right",
    render: (row) => formatMetricPercent(row.metrics.recall),
  },
  {
    key: "f1",
    header: "F1-score",
    align: "right",
    render: (row) => formatMetricPercent(row.metrics.f1),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <StatusBadge label={row.recommended ? "Recommended" : "Available"} tone={row.recommended ? "normal" : "info"} />
    ),
  },
];

type ModelInsightsPageProps = SyncCallbacks & {
  refreshNonce: number;
};

export function ModelInsightsPage({
  refreshNonce,
  onSyncSuccess,
  onSyncFailure,
}: ModelInsightsPageProps) {
  const [data, setData] = useState<ModelInsightsData | null>(null);
  const [status, setStatus] = useState<{
    type: "loading" | "success" | "error";
    message: string;
  }>({
    type: "loading",
    message: "Loading model metrics...",
  });

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    const loadModelInsights = async () => {
      if (requestInFlight) {
        return;
      }
      requestInFlight = true;

      try {
        const nextData = await fetchModelInsights();
        if (!active) {
          return;
        }
        setData(nextData);
        setStatus({
          type: "success",
          message: nextData.items.length > 0
            ? "Historical model metrics loaded from the backend."
            : "No model metrics are available yet.",
        });
        onSyncSuccess();
      } catch {
        if (!active) {
          return;
        }
        setStatus({
          type: "error",
          message: "Model metrics sync failed. Existing data remains available.",
        });
        onSyncFailure();
      } finally {
        requestInFlight = false;
      }
    };

    void loadModelInsights();
    const timer = window.setInterval(
      () => void loadModelInsights(),
      STANDARD_SYNC_INTERVAL_MS,
    );

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshNonce, onSyncFailure, onSyncSuccess]);

  const recommended = data?.items.find((item) => item.recommended) ?? data?.items[0] ?? null;

  return (
    <div className="page-grid">
      <Panel
        title="Model insights"
        subtitle="Historical training/evaluation metrics from backend metadata."
      >
        <div className="inline-meta">
          <span>{status.message}</span>
          <span>Selection metric: {data?.selectionMetric?.toUpperCase() ?? "Not available"}</span>
          <span>Last update {data ? formatTimestamp(data.generatedAt) : "Not available"}</span>
        </div>
      </Panel>

      <div className="summary-grid">
        <SummaryCard
          label="Recommended model"
          value={recommended ? formatModelName(recommended.modelName) : "Not available"}
          helper="Selected by backend model metadata"
          tone={recommended ? "normal" : "info"}
        />
        <SummaryCard
          label="Historical accuracy"
          value={formatMetricPercent(recommended?.metrics.accuracy)}
          helper="Stored evaluation metric"
          tone="info"
        />
        <SummaryCard
          label="Historical precision"
          value={formatMetricPercent(recommended?.metrics.precision)}
          helper="Stored evaluation metric"
          tone="suspicious"
        />
        <SummaryCard
          label="Historical recall"
          value={formatMetricPercent(recommended?.metrics.recall)}
          helper="Stored evaluation metric"
          tone="attack"
        />
        <SummaryCard
          label="Historical F1-score"
          value={formatMetricPercent(recommended?.metrics.f1)}
          helper="Stored evaluation metric"
          tone="normal"
        />
      </div>

      <div className="analytics-grid">
        <MetricChartPanel title="Model comparison" metric="f1" data={data} subtitle="Historical F1-score by model." />
        <MetricChartPanel title="Accuracy comparison" metric="accuracy" data={data} subtitle="Historical accuracy by model." />
      </div>

      <div className="analytics-grid">
        <MetricChartPanel title="Precision comparison" metric="precision" data={data} subtitle="Historical precision by model." />
        <MetricChartPanel title="Recall comparison" metric="recall" data={data} subtitle="Historical recall by model." />
      </div>

      <Panel title="Historical model comparison table">
        <div className="panel-table-wrap">
          {status.type === "loading" ? <LoadingOverlay message="Loading model metrics..." /> : null}
          {data && data.items.length > 0 ? (
            <DataTable columns={metricColumns} rows={data.items} rowKey={(row) => row.modelName} />
          ) : (
            <EmptyState
              title={status.type === "error" ? "Unable to load model metrics" : "No model metrics available"}
              description={status.type === "error" ? "Check the backend model metrics endpoint." : "Model metrics appear when backend metadata is available."}
            />
          )}
        </div>
      </Panel>
    </div>
  );
}

function MetricChartPanel({
  title,
  subtitle,
  metric,
  data,
}: {
  title: string;
  subtitle: string;
  metric: ModelMetricName;
  data: ModelInsightsData | null;
}) {
  const chartData =
    data?.items
      .filter((item) => typeof item.metrics[metric] === "number")
      .map((item) => ({
        label: formatModelName(item.modelName),
        value: Math.round((item.metrics[metric] ?? 0) * 10000) / 100,
        suffix: "%",
        color: item.recommended ? "#34d399" : "#60a5fa",
      })) ?? [];

  return (
    <Panel title={title} subtitle={subtitle}>
      {chartData.length > 0 ? (
        <D3BarChart data={chartData} />
      ) : (
        <EmptyState
          title={`${title} unavailable`}
          description="The backend did not return enough model metadata for this chart."
        />
      )}
    </Panel>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
