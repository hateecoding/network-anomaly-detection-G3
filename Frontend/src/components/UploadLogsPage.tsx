import { useDeferredValue, useEffect, useState } from "react";
import { AlertRecord, emptyUploadStateMessage, UploadAnalysisRow } from "../data/presentationData";
import {
  analyzeUploadedFile,
  exportCsvTemplate,
  exportUploadRows,
  formatModelMetric,
  formatModelName,
  UploadAnalysisResult,
  UploadModelAnalysisItem,
} from "../utils/uploadAnalysis";
import { AlertList } from "./AlertList";
import { D3BarChart } from "./D3BarChart";
import { D3HeatmapChart } from "./D3HeatmapChart";
import { D3HistogramChart } from "./D3HistogramChart";
import { D3LineChart } from "./D3LineChart";
import { D3PieChart } from "./D3PieChart";
import { DataColumn, DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { LoadingOverlay } from "./LoadingOverlay";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { SummaryCard } from "./SummaryCard";
import { UploadBox } from "./UploadBox";

const filterOptions = ["all", "attack", "review", "normal"] as const;
const sortOptions = ["priority", "record", "confidence", "attackProbability"] as const;
const pageSizeOptions = [25, 50, 100] as const;

type FilterOption = (typeof filterOptions)[number];
type SortOption = (typeof sortOptions)[number];

const columns: DataColumn<UploadAnalysisRow>[] = [
  {
    key: "rowId",
    header: "Record ID",
    render: (row) => <strong>{row.rowId}</strong>,
  },
  {
    key: "sourceIp",
    header: "Source IP",
    render: (row) => row.sourceIp,
  },
  {
    key: "destinationIp",
    header: "Destination IP",
    render: (row) => row.destinationIp,
  },
  {
    key: "protocol",
    header: "Protocol",
    render: (row) => row.protocol,
  },
  {
    key: "prediction",
    header: "Prediction",
    render: (row) => (
      <StatusBadge
        label={
          row.prediction === "Normal"
            ? "NORMAL"
            : row.prediction === "Review Recommended"
              ? "REVIEW RECOMMENDED"
              : "ATTACK"
        }
        tone={
          row.prediction === "Attack"
            ? "attack"
            : row.prediction === "Review Recommended"
              ? "suspicious"
              : "normal"
        }
      />
    ),
  },
  {
    key: "confidence",
    header: "Confidence",
    align: "right",
    render: (row) => `${row.confidence}%`,
  },
  {
    key: "detectionResult",
    header: "Detection Result",
    render: (row) => (
      <StatusBadge
        label={row.detectionResult}
        tone={row.detectionResult === "THREAT DETECTED" ? "attack" : "normal"}
      />
    ),
  },
];

const modelColumns: DataColumn<UploadModelAnalysisItem>[] = [
  {
    key: "model",
    header: "Model",
    render: (row) => <strong>{formatModelName(row.modelName)}</strong>,
  },
  {
    key: "accuracy",
    header: "Accuracy",
    align: "right",
    render: (row) => formatModelMetric(row.accuracy),
  },
  {
    key: "precision",
    header: "Precision",
    align: "right",
    render: (row) => formatModelMetric(row.precision),
  },
  {
    key: "recall",
    header: "Recall",
    align: "right",
    render: (row) => formatModelMetric(row.recall),
  },
  {
    key: "f1",
    header: "F1-score",
    align: "right",
    render: (row) => formatModelMetric(row.f1),
  },
  {
    key: "predictions",
    header: "Predictions",
    render: (row) => (
      <span>
        {row.normalPredictions.toLocaleString()} normal / {row.attackPredictions.toLocaleString()} attack
      </span>
    ),
  },
];

export function UploadLogsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<UploadAnalysisResult | null>(null);
  const [rows, setRows] = useState<UploadAnalysisRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sort, setSort] = useState<SortOption>("priority");
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(25);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({
    type: "idle",
    message: "Select a CSV file to begin backend analysis.",
  });
  const statusTone = state.type === "idle" ? "info" : state.type;
  const deferredQuery = useDeferredValue(query);
  const hasAnalysis = state.type === "success" && analysis !== null;
  const selectedModelAnalysis =
    analysis?.modelAnalysis.models.find((model) => model.modelName === analysis.modelAnalysis.bestModel) ??
    analysis?.modelAnalysis.models[0] ??
    null;
  const uploadStatus =
    state.type === "loading"
      ? { label: "PROCESSING", tone: "info" as const }
      : state.type === "success"
        ? { label: "SUCCESS", tone: "normal" as const }
        : state.type === "error"
          ? { label: "FAILED", tone: "attack" as const }
          : null;

  const filteredRows = sortRows(
    rows.filter((row) => {
      const rowFilterKey =
        row.prediction === "Review Recommended" ? "review" : row.prediction.toLowerCase();
      const matchesFilter = filter === "all" ? true : rowFilterKey === filter;
      const haystack = [
        row.rowId,
        row.sourceIp,
        row.destinationIp,
        row.protocol,
        row.prediction,
        row.detectionResult,
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = haystack.includes(deferredQuery.trim().toLowerCase());
      return matchesFilter && matchesQuery;
    }),
    sort,
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, filter, sort, pageSize, rows.length]);

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setState({
        type: "error",
        message: "Choose a CSV file before sending it to the backend.",
      });
      return;
    }

    try {
      setState({
        type: "loading",
        message: "Uploading file to the backend and waiting for model prediction results...",
      });

      const result = await analyzeUploadedFile(selectedFile);

      setAnalysis(result);
      setRows(result.rows);
      setAlerts(result.alerts);
      setState({
        type: "success",
        message: result.metadata.previewCapped
          ? `Analysis completed. Showing first ${result.metadata.returnedRecords.toLocaleString()} records for performance.`
          : `Analysis completed. Backend processed ${result.summary.totalRecords.toLocaleString()} rows.`,
      });
    } catch (error) {
      setAnalysis(null);
      setRows([]);
      setAlerts([]);
      setState({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Analysis failed. Please check the uploaded file format or backend service.",
      });
    }
  };

  return (
    <div className="page-grid">
      <Panel
        title="Upload and analyze"
        subtitle="Upload a network traffic dataset to generate analysis results."
      >
        <UploadBox file={selectedFile} onSelectFile={setSelectedFile} disabled={state.type === "loading"} />

        <div className="upload-toolbar">
          <button type="button" className="primary-button" onClick={handleAnalyze} disabled={state.type === "loading"}>
            Analyze file
          </button>
          <button type="button" className="secondary-button" onClick={exportCsvTemplate} disabled={state.type === "loading"}>
            Download CSV template
          </button>
          <div className="upload-status-line">
            {uploadStatus ? <StatusBadge label={uploadStatus.label} tone={uploadStatus.tone} /> : null}
            <span className={`inline-message inline-message-${statusTone}`}>{state.message}</span>
          </div>
        </div>
      </Panel>

      {!hasAnalysis ? (
        <EmptyState
          title="Upload a network traffic dataset to generate analysis results."
        />
      ) : null}

      {hasAnalysis ? (
        <>
      <div className="summary-grid upload-summary-grid">
        <SummaryCard
          label="Analyzed rows"
          value={formatCount(analysis?.summary.totalRecords ?? 0)}
          helper="Rows processed by the backend"
          tone="info"
        />
        <SummaryCard
          label="Attack %"
          value={`${formatDecimal(analysis?.summary.attackPercentage ?? 0)}%`}
          helper="Attack ratio in the uploaded dataset"
          tone="attack"
        />
        <SummaryCard
          label="Attack rows"
          value={formatCount(analysis?.summary.attackRecords ?? 0)}
          helper="Rows classified as threat traffic"
          tone="attack"
        />
        <SummaryCard
          label="Review score"
          value={`${analysis?.summary.riskScore ?? 0}/100`}
          helper="Calculated from attack and review pressure"
          tone={getRiskTone(analysis?.summary.riskScore ?? 0)}
        />
        <SummaryCard
          label="Review Recommended"
          value={formatCount(analysis?.summary.suspiciousRecords ?? 0)}
          helper="Rows requiring analyst review"
          tone="suspicious"
        />
        <SummaryCard
          label="Normal"
          value={formatCount(analysis?.summary.normalRecords ?? 0)}
          helper="Rows classified as normal traffic"
          tone="normal"
        />
        <SummaryCard
          label="Model used"
          value={formatModelName(analysis?.modelAnalysis.bestModel)}
          helper="Selected for this dataset"
          tone="info"
        />
        <SummaryCard
          label="Avg confidence"
          value={formatModelMetric(selectedModelAnalysis?.averageConfidence)}
          helper="Selected model confidence"
          tone="normal"
        />
      </div>

      <Panel title="Processing details" subtitle="Latest backend result.">
        <div className="result-meta-grid">
          <MetaItem label="Last processed filename" value={analysis?.summary.filename ?? selectedFile?.name ?? "No file processed"} />
          <MetaItem label="Last updated timestamp" value={analysis ? formatTimestamp(analysis.summary.updatedAt) : "Not available"} />
          <MetaItem label="Rows retained for table preview" value={analysis ? `${formatCount(analysis.metadata.returnedRecords)} of ${formatCount(analysis.metadata.totalRecords)}` : "0"} />
          <MetaItem label="Preview handling" value={analysis?.metadata.previewCapped ? `First ${analysis.metadata.previewLimit.toLocaleString()} records returned` : "Full row set returned"} />
        </div>
      </Panel>

      <div className="analytics-grid">
        <Panel title="Traffic composition" subtitle="Classification balance.">
          {analysis ? (
            <D3PieChart
              segments={analysis.charts.composition}
              centerLabel="Attack rate"
              centerValue={`${formatDecimal(analysis.summary.attackPercentage)}%`}
            />
          ) : (
            <EmptyState title="No analysis yet" description="Run an upload analysis to populate the composition chart." />
          )}
        </Panel>

        <Panel title="Anomaly trend" subtitle="Grouped by row ranges.">
          {analysis && analysis.charts.trend.length > 0 ? (
            <D3LineChart
              series={[
                {
                  key: "review",
                  label: "Review Recommended",
                  color: "#fbbf24",
                  values: analysis.charts.trend.map((point) => ({ label: point.label, value: point.suspicious })),
                },
                {
                  key: "attack",
                  label: "Attack",
                  color: "#f97316",
                  values: analysis.charts.trend.map((point) => ({ label: point.label, value: point.attack })),
                },
              ]}
            />
          ) : (
            <EmptyState title="No trend available" description="Trend buckets appear after the backend returns analyzed rows." />
          )}
        </Panel>
      </div>

      <div className="analytics-grid">
        <Panel title="Protocol distribution" subtitle="Protocol mix from analyzed rows.">
          {analysis && analysis.charts.protocols.length > 0 ? (
            <D3BarChart data={analysis.charts.protocols} />
          ) : (
            <EmptyState title="No protocol data" description="Protocol distribution appears when records include protocol fields." />
          )}
        </Panel>

        <Panel title="Top review source IPs" subtitle="Highest-volume flagged sources.">
          {analysis && analysis.charts.topSourceIps.length > 0 ? (
            <D3BarChart data={analysis.charts.topSourceIps} />
          ) : (
            <EmptyState title="No review sources" description="Source IP concentration appears when review or attack rows are present." />
          )}
        </Panel>
      </div>

      <Panel title="Attack probability distribution" subtitle="Probability buckets returned by the backend model.">
        {analysis ? (
          <D3HistogramChart data={analysis.charts.confidenceBuckets} height={240} />
        ) : (
          <EmptyState title="No probability data" description="Attack probability buckets appear after a successful backend analysis." />
        )}
      </Panel>

      <Panel title="Dataset Model Analysis" subtitle="Model behavior on this upload.">
        <div className="summary-grid upload-summary-grid">
          <SummaryCard
            label="Best model"
            value={formatModelName(analysis.modelAnalysis.bestModel)}
            helper={analysis.modelAnalysis.labelsAvailable ? "Highest dataset F1-score" : "Configured backend selection"}
            tone="normal"
          />
          <SummaryCard
            label="Highest recall"
            value={formatModelName(analysis.modelAnalysis.highestRecallModel)}
            helper="Available when labels exist"
            tone="suspicious"
          />
          <SummaryCard
            label="Highest F1-score"
            value={formatModelName(analysis.modelAnalysis.highestF1Model)}
            helper="Available when labels exist"
            tone="info"
          />
          <SummaryCard
            label="Evaluated records"
            value={analysis.modelAnalysis.evaluatedRecords.toLocaleString()}
            helper="Rows compared across models"
            tone="info"
          />
          <SummaryCard
            label="Labels"
            value={analysis.modelAnalysis.labelsAvailable ? "Available" : "Not Available"}
            helper="Ground-truth evaluation"
            tone={analysis.modelAnalysis.labelsAvailable ? "normal" : "suspicious"}
          />
        </div>

        {!analysis.modelAnalysis.labelsAvailable ? (
          <div className="empty-state subtle-state">
            <h4>Accuracy metrics unavailable</h4>
            <p>
              Ground-truth labels were not found in this dataset, so accuracy-based evaluation is unavailable. The system is showing prediction distribution and confidence analysis only.
            </p>
          </div>
        ) : null}

        <div className="analytics-grid model-analysis-grid">
          {analysis.modelAnalysis.charts.performance.length > 0 ? (
            <Panel title="Model performance" subtitle="Accuracy, precision, recall, and F1.">
              <D3BarChart data={analysis.modelAnalysis.charts.performance} height={340} />
            </Panel>
          ) : null}

          <Panel title="Prediction distribution" subtitle="Normal vs attack by model.">
            {analysis.modelAnalysis.charts.predictionDistribution.length > 0 ? (
              <D3BarChart data={analysis.modelAnalysis.charts.predictionDistribution} height={320} />
            ) : (
              <EmptyState title="No model distribution" description="No per-model predictions were returned." />
            )}
          </Panel>

          <Panel title="Model confidence" subtitle="Confidence buckets across models.">
            {analysis.modelAnalysis.charts.confidenceBuckets.length > 0 ? (
              <D3HistogramChart data={analysis.modelAnalysis.charts.confidenceBuckets} height={320} />
            ) : (
              <EmptyState title="No confidence data" description="Model confidence buckets were not returned." />
            )}
          </Panel>

          {analysis.modelAnalysis.labelsAvailable && analysis.modelAnalysis.models[0]?.confusionMatrix.length ? (
            <Panel title="Confusion matrix" subtitle={formatModelName(analysis.modelAnalysis.models[0].modelName)}>
              <D3HeatmapChart data={analysis.modelAnalysis.models[0].confusionMatrix} />
            </Panel>
          ) : null}
        </div>

        <div className="panel-table-wrap model-table-wrap">
          <DataTable
            columns={modelColumns}
            rows={analysis.modelAnalysis.models}
            rowKey={(row) => row.modelName}
            emptyState={
              <EmptyState
                title="No model analysis"
                description="Per-model upload analysis was not returned by the backend."
              />
            }
          />
        </div>
      </Panel>

      <Panel
        title="Analyzed result table"
        subtitle="Paginated investigation view."
        aside={
          filteredRows.length > 0 ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportUploadRows(filteredRows)}
            >
              Export filtered preview
            </button>
          ) : null
        }
      >
        <div className="table-control-grid">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="search-input"
            placeholder="Search record, IP, protocol, prediction, or result"
          />
          <label className="control-label">
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
              <option value="priority">Threat priority</option>
              <option value="record">Record ID</option>
              <option value="confidence">Confidence</option>
              <option value="attackProbability">Attack probability</option>
            </select>
          </label>
          <label className="control-label">
            Rows per page
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as typeof pageSize)}>
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-row">
          <div className="chip-row">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${filter === option ? "chip-active" : ""}`}
                onClick={() => setFilter(option)}
              >
                {option === "all"
                  ? "Show all"
                  : option === "review"
                    ? "Show review recommended only"
                    : `Show ${option} only`}
              </button>
            ))}
          </div>
          <span className="table-count-copy">
            Showing {filteredRows.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageSize, filteredRows.length)} of {formatCount(filteredRows.length)} rows
          </span>
        </div>

        <div className="panel-table-wrap">
          {state.type === "loading" ? <LoadingOverlay message="Uploading CSV and processing model predictions..." /> : null}
          <DataTable
            columns={columns}
            rows={paginatedRows}
            rowKey={(row) => row.rowId}
            rowClassName={(row) =>
              `table-row-${row.prediction === "Review Recommended" ? "suspicious" : row.prediction.toLowerCase()}`
            }
            emptyState={
              <EmptyState
                title="No results yet"
                description={emptyUploadStateMessage}
              />
            }
          />
        </div>

        <div className="pagination-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={safePage === 1}
          >
            Previous
          </button>
          <span>
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={safePage === totalPages}
          >
            Next
          </button>
        </div>
      </Panel>

        <Panel title="Upload alerts" subtitle="Rows requiring analyst attention.">
        {alerts.length > 0 ? (
          <AlertList alerts={alerts} />
        ) : (
          <EmptyState
            title="No upload alerts yet"
            description="Run an analysis to populate this alert section."
          />
        )}
      </Panel>
      </>
      ) : null}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="result-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function sortRows(rows: UploadAnalysisRow[], sort: SortOption) {
  return [...rows].sort((left, right) => {
    if (sort === "record") {
      return left.recordNumber - right.recordNumber;
    }

    if (sort === "confidence") {
      return right.confidence - left.confidence || left.recordNumber - right.recordNumber;
    }

    if (sort === "attackProbability") {
      return right.attackProbability - left.attackProbability || left.recordNumber - right.recordNumber;
    }

    return getPriority(right) - getPriority(left) || right.attackProbability - left.attackProbability || left.recordNumber - right.recordNumber;
  });
}

function getPriority(row: UploadAnalysisRow) {
  if (row.prediction === "Attack") {
    return 2;
  }

  if (row.prediction === "Review Recommended") {
    return 1;
  }

  return 0;
}

function getRiskTone(score: number) {
  if (score >= 60) {
    return "attack";
  }

  if (score >= 25) {
    return "suspicious";
  }

  return "normal";
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatDecimal(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
