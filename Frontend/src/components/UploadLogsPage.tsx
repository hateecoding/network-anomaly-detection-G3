import { useDeferredValue, useEffect, useState } from "react";
import { AlertRecord, emptyUploadStateMessage, UploadAnalysisRow } from "../data/presentationData";
import { analyzeUploadedFile, exportUploadRows, UploadAnalysisResult } from "../utils/uploadAnalysis";
import { AlertList } from "./AlertList";
import { BarChart } from "./BarChart";
import { DataColumn, DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { LineChart } from "./LineChart";
import { LoadingOverlay } from "./LoadingOverlay";
import { Panel } from "./Panel";
import { PieChart } from "./PieChart";
import { StatusBadge } from "./StatusBadge";
import { SummaryCard } from "./SummaryCard";
import { UploadBox } from "./UploadBox";

const filterOptions = ["all", "attack", "suspicious", "normal"] as const;
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
        label={row.prediction === "Normal" ? "NORMAL" : row.prediction === "Suspicious" ? "SUSPICIOUS" : "ATTACK"}
        tone={
          row.prediction === "Attack"
            ? "attack"
            : row.prediction === "Suspicious"
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

  const filteredRows = sortRows(
    rows.filter((row) => {
      const matchesFilter =
        filter === "all" ? true : row.prediction.toLowerCase() === filter;
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
        message: `Analysis completed. Backend processed ${result.summary.totalRecords.toLocaleString()} rows.`,
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
        subtitle="Upload a CSV log file and review the model prediction result returned by the FastAPI backend."
      >
        <UploadBox file={selectedFile} onSelectFile={setSelectedFile} disabled={state.type === "loading"} />

        <div className="upload-toolbar">
          <button type="button" className="primary-button" onClick={handleAnalyze} disabled={state.type === "loading"}>
            Analyze file
          </button>
          <span className={`inline-message inline-message-${statusTone}`}>{state.message}</span>
        </div>
      </Panel>

      <div className="summary-grid upload-summary-grid">
        <SummaryCard
          label="Total analyzed rows"
          value={formatCount(analysis?.summary.totalRecords ?? 0)}
          helper="Rows processed by the backend"
          tone="info"
        />
        <SummaryCard
          label="Normal rows"
          value={formatCount(analysis?.summary.normalRecords ?? 0)}
          helper="Rows classified as normal traffic"
          tone="normal"
        />
        <SummaryCard
          label="Suspicious rows"
          value={formatCount(analysis?.summary.suspiciousRecords ?? 0)}
          helper="Rows requiring analyst review"
          tone="suspicious"
        />
        <SummaryCard
          label="Attack rows"
          value={formatCount(analysis?.summary.attackRecords ?? 0)}
          helper="Rows classified as threat traffic"
          tone="attack"
        />
        <SummaryCard
          label="Attack percentage"
          value={`${formatDecimal(analysis?.summary.attackPercentage ?? 0)}%`}
          helper="Attack ratio in the uploaded dataset"
          tone="attack"
        />
        <SummaryCard
          label="Risk score"
          value={`${analysis?.summary.riskScore ?? 0}/100`}
          helper="Calculated from attack and suspicious pressure"
          tone={getRiskTone(analysis?.summary.riskScore ?? 0)}
        />
        <SummaryCard
          label="Top attack type"
          value={analysis?.summary.topAttackType ?? "Not reported"}
          helper="Reported when attack labels are available"
          tone="suspicious"
        />
        <SummaryCard
          label="Processing status"
          value={state.type === "success" ? "SUCCESS" : state.type === "error" ? "FAILED" : "WAITING"}
          helper={analysis ? "Backend processed" : "Awaiting upload"}
          tone={state.type === "success" ? "normal" : state.type === "error" ? "attack" : "info"}
        />
      </div>

      <Panel title="Processing details" subtitle="Latest backend result metadata for the uploaded dataset.">
        <div className="result-meta-grid">
          <MetaItem label="Last processed filename" value={analysis?.summary.filename ?? selectedFile?.name ?? "No file processed"} />
          <MetaItem label="Last updated timestamp" value={analysis ? formatTimestamp(analysis.summary.updatedAt) : "Not available"} />
          <MetaItem label="Rows retained for table preview" value={analysis ? `${formatCount(rows.length)} of ${formatCount(analysis.metadata.totalRecordsReturned)}` : "0"} />
          <MetaItem label="Preview handling" value={analysis?.metadata.previewCapped ? `Prioritized top ${analysis.metadata.previewLimit.toLocaleString()} rows` : "Full returned row set available"} />
        </div>
      </Panel>

      <div className="analytics-grid">
        <Panel title="Traffic composition" subtitle="Normal, suspicious, and attack balance from the processed dataset.">
          {analysis ? (
            <PieChart
              segments={analysis.charts.composition}
              centerLabel="Attack rate"
              centerValue={`${formatDecimal(analysis.summary.attackPercentage)}%`}
            />
          ) : (
            <EmptyState title="No analysis yet" description="Run an upload analysis to populate the composition chart." />
          )}
        </Panel>

        <Panel title="Anomaly and attack trend" subtitle="Aggregated by record ranges so large uploads stay responsive.">
          {analysis && analysis.charts.trend.length > 0 ? (
            <LineChart
              series={[
                {
                  key: "suspicious",
                  label: "Suspicious",
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
        <Panel title="Protocol distribution" subtitle="Protocol mix in the uploaded dataset response.">
          {analysis && analysis.charts.protocols.length > 0 ? (
            <BarChart data={analysis.charts.protocols} />
          ) : (
            <EmptyState title="No protocol data" description="Protocol distribution appears when records include protocol fields." />
          )}
        </Panel>

        <Panel title="Top suspicious source IPs" subtitle="Highest-volume sources among suspicious or attack rows.">
          {analysis && analysis.charts.topSourceIps.length > 0 ? (
            <BarChart data={analysis.charts.topSourceIps} />
          ) : (
            <EmptyState title="No suspicious sources" description="Source IP concentration appears when suspicious or attack rows are present." />
          )}
        </Panel>
      </div>

      <Panel title="Confidence distribution" subtitle="Prediction confidence grouped into safe chart buckets.">
        {analysis ? (
          <BarChart data={analysis.charts.confidenceBuckets} height={240} />
        ) : (
          <EmptyState title="No confidence data" description="Confidence distribution appears after a successful backend analysis." />
        )}
      </Panel>

      <Panel
        title="Analyzed result table"
        subtitle="Paginated investigation view prioritized by suspicious and attack rows."
        aside={
          filteredRows.length > 0 ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportUploadRows(filteredRows)}
            >
              Export filtered results
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
                {option === "all" ? "Show all" : `Show ${option} only`}
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
            rowClassName={(row) => `table-row-${row.prediction.toLowerCase()}`}
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

      <Panel title="Upload alerts" subtitle="Backend alert records generated from rows above normal risk.">
        {alerts.length > 0 ? (
          <AlertList alerts={alerts} />
        ) : (
          <EmptyState
            title="No upload alerts yet"
            description="Run an analysis to populate this alert section."
          />
        )}
      </Panel>
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

  if (row.prediction === "Suspicious") {
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
