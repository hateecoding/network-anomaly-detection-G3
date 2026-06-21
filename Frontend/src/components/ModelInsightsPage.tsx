import { useEffect, useState } from "react";
import {
  fetchModelInsights,
  formatMetricPercent,
  formatModelName,
  ModelInsightItem,
  ModelInsightsData,
  ModelMetricName,
} from "../utils/modelInsights";
import { BarChart } from "./BarChart";
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

export function ModelInsightsPage() {
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

    fetchModelInsights()
      .then((nextData) => {
        if (!active) {
          return;
        }
        setData(nextData);
        setStatus({
          type: "success",
          message: nextData.items.length > 0 ? "Model metrics loaded from the backend." : "No model metrics are available yet.",
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setData(null);
        setStatus({
          type: "error",
          message: "Unable to load model metrics from the backend.",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const recommended = data?.items.find((item) => item.recommended) ?? data?.items[0] ?? null;

  return (
    <div className="page-grid">
      <Panel
        title="Model insights"
        subtitle="Backend model metadata loaded from the deployed model metrics endpoint."
      >
        <div className="hero-note-copy">
          This page reports model performance metadata exposed by FastAPI. It does not invent training results when metadata is unavailable.
        </div>
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
          label="Accuracy"
          value={formatMetricPercent(recommended?.metrics.accuracy)}
          helper="Recommended model accuracy"
          tone="info"
        />
        <SummaryCard
          label="Precision"
          value={formatMetricPercent(recommended?.metrics.precision)}
          helper="Positive prediction reliability"
          tone="suspicious"
        />
        <SummaryCard
          label="Recall"
          value={formatMetricPercent(recommended?.metrics.recall)}
          helper="Attack detection coverage"
          tone="attack"
        />
        <SummaryCard
          label="F1-score"
          value={formatMetricPercent(recommended?.metrics.f1)}
          helper="Balanced precision and recall"
          tone="normal"
        />
      </div>

      <div className="analytics-grid">
        <MetricChartPanel title="Model comparison" metric="f1" data={data} subtitle="F1-score comparison across available models." />
        <MetricChartPanel title="Accuracy comparison" metric="accuracy" data={data} subtitle="Accuracy reported by backend model metadata." />
      </div>

      <div className="analytics-grid">
        <MetricChartPanel title="Precision comparison" metric="precision" data={data} subtitle="Precision reported by backend model metadata." />
        <MetricChartPanel title="Recall comparison" metric="recall" data={data} subtitle="Recall reported by backend model metadata." />
      </div>

      <div className="analytics-grid">
        <Panel title="Confusion matrix" subtitle="Shown when backend exposes confusion-matrix metadata.">
          <EmptyState
            title="Confusion matrix not available"
            description="The current backend model metrics response does not include confusion-matrix values."
          />
        </Panel>

        <Panel title="Confidence distribution" subtitle="Shown when backend exposes prediction confidence buckets.">
          <EmptyState
            title="Confidence distribution not available"
            description="The current backend model metrics response does not include confidence bucket metadata."
          />
        </Panel>
      </div>

      <Panel title="Model comparison table" subtitle="Raw model metrics returned by the backend.">
        <div className="panel-table-wrap">
          {status.type === "loading" ? <LoadingOverlay message="Loading model metrics..." /> : null}
          {data && data.items.length > 0 ? (
            <DataTable columns={metricColumns} rows={data.items} rowKey={(row) => row.modelName} />
          ) : (
            <EmptyState
              title={status.type === "error" ? "Unable to load model metrics" : "No model metrics available"}
              description={status.type === "error" ? "Please check the backend service and model metrics endpoint." : "Model metrics will appear after the backend returns model metadata."}
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
        <BarChart data={chartData} />
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
