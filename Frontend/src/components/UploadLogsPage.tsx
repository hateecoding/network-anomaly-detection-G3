import { useDeferredValue, useState } from "react";
import { AlertRecord, emptyUploadStateMessage, UploadAnalysisRow } from "../data/presentationData";
import { analyzeUploadedFile, exportUploadRows } from "../utils/uploadAnalysis";
import { AlertList } from "./AlertList";
import { DataColumn, DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { LoadingOverlay } from "./LoadingOverlay";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { SummaryCard } from "./SummaryCard";
import { UploadBox } from "./UploadBox";

const filterOptions = ["all", "normal", "suspicious", "attack"] as const;

const columns: DataColumn<UploadAnalysisRow>[] = [
  {
    key: "rowId",
    header: "Row",
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
    key: "service",
    header: "Service",
    render: (row) => row.service,
  },
  {
    key: "duration",
    header: "Duration",
    align: "right",
    render: (row) => `${row.duration}s`,
  },
  {
    key: "prediction",
    header: "Prediction",
    render: (row) => (
      <StatusBadge
        label={row.prediction}
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
    key: "alertLevel",
    header: "Alert",
    render: (row) => (
      <StatusBadge
        label={row.alertLevel}
        tone={
          row.alertLevel === "High"
            ? "attack"
            : row.alertLevel === "Medium"
              ? "suspicious"
              : "normal"
        }
      />
    ),
  },
];

export function UploadLogsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rows, setRows] = useState<UploadAnalysisRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filterOptions)[number]>("all");
  const [state, setState] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({
    type: "idle",
    message: "No file analyzed yet.",
  });
  const statusTone = state.type === "idle" ? "info" : state.type;

  const deferredQuery = useDeferredValue(query);
  const filteredRows = rows.filter((row) => {
    const matchesFilter =
      filter === "all" ? true : row.prediction.toLowerCase() === filter;
    const haystack = `${row.rowId} ${row.sourceIp} ${row.destinationIp} ${row.protocol} ${row.service}`.toLowerCase();
    const matchesQuery = haystack.includes(deferredQuery.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const normalCount = rows.filter((row) => row.prediction === "Normal").length;
  const suspiciousCount = rows.filter((row) => row.prediction === "Suspicious").length;
  const attackCount = rows.filter((row) => row.prediction === "Attack").length;

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
        message: "Uploading file to the backend and waiting for analysis...",
      });

      const result = await analyzeUploadedFile(selectedFile);

      setRows(result.rows);
      setAlerts(result.alerts);
      setState({
        type: "success",
        message: `Successfully analyzed ${result.summary.totalRecords} rows via the backend.`,
      });
    } catch (error) {
      setRows([]);
      setAlerts([]);
      setState({
        type: "error",
        message:
          error instanceof Error ? error.message : "The file could not be analyzed.",
      });
    }
  };

  return (
    <div className="page-grid">
      <Panel
        title="Upload and analyze"
        subtitle="Upload a CSV log file and review the AI analysis returned by the backend."
      >
        <UploadBox file={selectedFile} onSelectFile={setSelectedFile} disabled={state.type === "loading"} />

        <div className="upload-toolbar">
          <button type="button" className="primary-button" onClick={handleAnalyze} disabled={state.type === "loading"}>
            Analyze file
          </button>
          <span className={`inline-message inline-message-${statusTone}`}>{state.message}</span>
        </div>
      </Panel>

      <div className="summary-grid">
        <SummaryCard
          label="Analyzed rows"
          value={rows.length.toString()}
          helper="Rows currently shown in the results table"
          tone="info"
        />
        <SummaryCard
          label="Normal rows"
          value={normalCount.toString()}
          helper="Rows predicted as normal"
          tone="normal"
        />
        <SummaryCard
          label="Suspicious rows"
          value={suspiciousCount.toString()}
          helper="Rows flagged for review"
          tone="suspicious"
        />
        <SummaryCard
          label="Attack rows"
          value={attackCount.toString()}
          helper="Rows escalated to highest alert level"
          tone="attack"
        />
      </div>

      <Panel
        title="Analyzed rows"
        subtitle="Search and filter the analyzed rows returned from the backend."
        aside={
          rows.length > 0 ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportUploadRows(filteredRows)}
            >
              Export results
            </button>
          ) : null
        }
      >
        <div className="filter-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="search-input"
            placeholder="Search row, IP, protocol, or service"
          />
          <div className="chip-row">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${filter === option ? "chip-active" : ""}`}
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-table-wrap">
          {state.type === "loading" ? <LoadingOverlay message="Uploading CSV and processing model predictions..." /> : null}
          <DataTable
            columns={columns}
            rows={filteredRows}
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
      </Panel>

      <Panel title="Upload alerts" subtitle="Rows flagged above normal are summarized for analyst review.">
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
