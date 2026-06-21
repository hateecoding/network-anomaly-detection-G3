import { requestJson } from "./api";

export type ModelMetricName = "accuracy" | "precision" | "recall" | "f1" | "roc_auc";

export type ModelMetrics = Partial<Record<ModelMetricName, number>>;

export type ModelInsightItem = {
  modelName: string;
  recommended: boolean;
  metrics: ModelMetrics;
};

export type ModelInsightsData = {
  generatedAt: string;
  selectionMetric: string | null;
  recommendedModel: string | null;
  items: ModelInsightItem[];
};

type BackendModelMetricsResponse = {
  generated_at: string;
  selection_metric?: string | null;
  recommended_model?: string | null;
  items: {
    model_name: string;
    recommended: boolean;
    metrics?: {
      accuracy?: number | null;
      precision?: number | null;
      recall?: number | null;
      f1?: number | null;
      roc_auc?: number | null;
    } | null;
  }[];
};

export async function fetchModelInsights(): Promise<ModelInsightsData> {
  const response = await requestJson<BackendModelMetricsResponse>("/model-metrics");

  return {
    generatedAt: response.generated_at,
    selectionMetric: response.selection_metric ?? null,
    recommendedModel: response.recommended_model ?? null,
    items: response.items.map((item) => ({
      modelName: item.model_name,
      recommended: item.recommended,
      metrics: normalizeMetrics(item.metrics),
    })),
  };
}

export function formatModelName(value: string) {
  return value
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMetricPercent(value?: number | null) {
  if (typeof value !== "number") {
    return "Not available";
  }

  return `${Math.round(value * 10000) / 100}%`;
}

function normalizeMetrics(metrics: BackendModelMetricsResponse["items"][number]["metrics"]): ModelMetrics {
  if (!metrics) {
    return {};
  }

  return {
    accuracy: normalizeMetric(metrics.accuracy),
    precision: normalizeMetric(metrics.precision),
    recall: normalizeMetric(metrics.recall),
    f1: normalizeMetric(metrics.f1),
    roc_auc: normalizeMetric(metrics.roc_auc),
  };
}

function normalizeMetric(value?: number | null) {
  return typeof value === "number" ? value : undefined;
}
