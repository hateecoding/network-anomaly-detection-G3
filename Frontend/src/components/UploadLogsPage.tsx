import { useDeferredValue, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { UploadAnalysisRow } from "../data/presentationData";
import { checkBackendHealth } from "../utils/api";
import { exportChartCardAsPng } from "../utils/d3ChartUtils";
import { STANDARD_SYNC_INTERVAL_MS, type SyncCallbacks } from "../utils/sync";
import {
  analyzeUploadedFile,
  clearCachedUploadAnalysis,
  exportCsvTemplate,
  exportUploadAnalysisJson,
  exportUploadRows,
  formatModelMetric,
  formatModelName,
  loadCachedUploadAnalysis,
  saveCachedUploadAnalysis,
  type UploadAnalysisResult,
  type UploadModelAnalysisItem,
} from "../utils/uploadAnalysis";
import { D3HeatmapChart } from "./D3HeatmapChart";
import { D3ProbabilityHistogram } from "./D3ProbabilityHistogram";
import { D3ProtocolRiskChart } from "./D3ProtocolRiskChart";
import { D3RiskTrendChart } from "./D3RiskTrendChart";
import { BarChart as D3BarChart } from "./BarChart";
import { PieChart as D3PieChart } from "./PieChart";
import {
  D3ScatterPlot,
  scatterFeatureLabels,
  type ScatterFeature,
} from "./D3ScatterPlot";
import { DataTable, type DataColumn } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { ExportableChartPanel } from "./ExportableChartPanel";
import { LoadingOverlay } from "./LoadingOverlay";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { UploadBox } from "./UploadBox";

const pageSizeOptions = [25, 50, 100] as const;
type FilterOption = "all" | "attack" | "review" | "normal";
type SortOption = "priority" | "record" | "confidence" | "attackProbability";

const modelColumns: DataColumn<UploadModelAnalysisItem>[] = [
  { key: "model", header: "Model", render: (row) => <strong>{formatModelName(row.modelName)}</strong> },
  { key: "accuracy", header: "Accuracy", align: "right", render: (row) => formatModelMetric(row.accuracy) },
  { key: "precision", header: "Precision", align: "right", render: (row) => formatModelMetric(row.precision) },
  { key: "recall", header: "Recall", align: "right", render: (row) => formatModelMetric(row.recall) },
  { key: "f1", header: "F1-score", align: "right", render: (row) => formatModelMetric(row.f1) },
  {
    key: "predictions",
    header: "Predictions",
    render: (row) => `${row.normalPredictions.toLocaleString()} normal / ${row.attackPredictions.toLocaleString()} attack`,
  },
];

type UploadLogsPageProps = SyncCallbacks & {
  refreshNonce: number;
};

export function UploadLogsPage({
  refreshNonce,
  onSyncSuccess,
  onSyncFailure,
}: UploadLogsPageProps) {
  // Restores the latest real backend analysis so returning to this page does not reset the presentation.
  const [cachedAnalysis] = useState(() => loadCachedUploadAnalysis());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<UploadAnalysisResult | null>(cachedAnalysis);
  const [rows, setRows] = useState<UploadAnalysisRow[]>(cachedAnalysis?.rows ?? []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sort, setSort] = useState<SortOption>("priority");
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null);
  const [selectedProbabilityBucket, setSelectedProbabilityBucket] = useState<string | null>(null);
  const [probabilityMin, setProbabilityMin] = useState(0);
  const [probabilityMax, setProbabilityMax] = useState(100);
  const [rowStart, setRowStart] = useState(1);
  const [rowEnd, setRowEnd] = useState(cachedAnalysis?.metadata.totalRecords ?? 1);
  const [selectedRow, setSelectedRow] = useState<number | null>(
    cachedAnalysis?.rows[0]?.recordNumber ?? null,
  );
  const [xFeature, setXFeature] = useState<ScatterFeature>("totalBytes");
  const [yFeature, setYFeature] = useState<ScatterFeature>("duration");
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(25);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({
    type: cachedAnalysis ? "success" : "idle",
    message: cachedAnalysis
      ? `Restored cached analysis: ${cachedAnalysis.summary.filename}.`
      : "Select a CSV file to begin backend analysis.",
  });

  const deferredQuery = useDeferredValue(query);
  const hasAnalysis = analysis !== null;
  const estimatedAverageAttackProbability = analysis
    ? estimateAverageProbability(analysis.charts.probabilityBuckets)
    : 0;
  const uniqueProtocols = [...new Set(rows.map((row) => row.protocol))].sort();
  const restoredCacheActive = hasAnalysis && !selectedFile && state.type === "success";

  const filteredRows = sortRows(
    rows.filter((row) => {
      // Filters operate on the returned preview rows; full-dataset totals remain in backend aggregates.
      const rowFilterKey =
        row.prediction === "Review Recommended" ? "review" : row.prediction.toLowerCase();
      const matchesFilter = filter === "all" || rowFilterKey === filter;
      const matchesProtocol = !protocolFilter || row.protocol === protocolFilter;
      const matchesProbability =
        row.attackProbability >= probabilityMin && row.attackProbability <= probabilityMax;
      const matchesRowRange = row.recordNumber >= rowStart && row.recordNumber <= rowEnd;
      const haystack = [
        row.rowId,
        row.sourceIp,
        row.destinationIp,
        row.protocol,
        row.service,
        row.modelPrediction,
        row.prediction,
      ].join(" ").toLowerCase();
      const matchesQuery = haystack.includes(deferredQuery.trim().toLowerCase());
      return matchesFilter && matchesProtocol && matchesProbability && matchesRowRange && matchesQuery;
    }),
    sort,
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(pageStart, pageStart + pageSize);

  const selectRow = (recordNumber: number) => {
    setSelectedRow(recordNumber);
  };

  const columns: DataColumn<UploadAnalysisRow>[] = [
    { key: "rowId", header: "Row", render: (row) => <strong>{row.rowId}</strong> },
    { key: "protocol", header: "Protocol", render: (row) => row.protocol },
    { key: "service", header: "Service", render: (row) => row.service.toUpperCase() },
    {
      key: "modelPrediction",
      header: "Model prediction",
      render: (row) => <StatusBadge label={row.modelPrediction.toUpperCase()} tone={row.modelPrediction === "Attack" ? "attack" : "normal"} />,
    },
    {
      key: "displayCategory",
      header: "Display category",
      render: (row) => (
        <StatusBadge
          label={row.prediction.toUpperCase()}
          tone={row.prediction === "Attack" ? "attack" : row.prediction === "Review Recommended" ? "suspicious" : "normal"}
        />
      ),
    },
    { key: "attackProbability", header: "Attack probability", align: "right", render: (row) => `${row.attackProbability}%` },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <button type="button" className="table-action-button" onClick={(event) => {
          event.stopPropagation();
          selectRow(row.recordNumber);
        }}>
          {row.prediction === "Normal" ? "View details" : "Review record"}
        </button>
      ),
    },
  ];

  useEffect(() => {
    setPage(1);
  }, [
    deferredQuery,
    filter,
    pageSize,
    probabilityMax,
    probabilityMin,
    protocolFilter,
    rowEnd,
    rowStart,
    rows.length,
    sort,
  ]);

  useEffect(() => {
    if (analysis) {
      setRowEnd(analysis.metadata.totalRecords);
      setSelectedRow((current) => current ?? rows[0]?.recordNumber ?? null);
    }
  }, [analysis, rows]);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const syncBackendStatus = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        await checkBackendHealth();
        if (active) {
          onSyncSuccess();
        }
      } catch {
        if (active) {
          onSyncFailure();
        }
      } finally {
        requestInFlight = false;
      }
    };
    void syncBackendStatus();
    // Upload Logs only polls backend health; analysis runs exclusively when the user clicks Analyze.
    const timer = window.setInterval(() => void syncBackendStatus(), STANDARD_SYNC_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshNonce, onSyncFailure, onSyncSuccess]);

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setState({ type: "error", message: "Choose a CSV file before analysis." });
      return;
    }
    try {
      setState({ type: "loading", message: "Uploading and running model analysis..." });
      // Backend returns capped rows plus full aggregate charts to avoid oversized browser responses.
      const result = await analyzeUploadedFile(selectedFile);
      setAnalysis(result);
      setRows(result.rows);
      setSelectedRow(result.rows[0]?.recordNumber ?? null);
      setRowStart(1);
      setRowEnd(result.metadata.totalRecords);
      setProbabilityMin(0);
      setProbabilityMax(100);
      const cached = saveCachedUploadAnalysis(result);
      setState({
        type: "success",
        message: `${result.metadata.previewCapped
          ? `Analysis completed. Showing first ${result.metadata.returnedRecords.toLocaleString()} records for performance.`
          : `Analysis completed. Backend processed ${result.summary.totalRecords.toLocaleString()} rows.`
        }${cached ? "" : " Local cache is unavailable."}`,
      });
      onSyncSuccess(new Date(result.summary.updatedAt));
    } catch (error) {
      setState({
        type: "error",
        message: error instanceof Error
          ? error.message
          : "Analysis failed. Check the CSV format or backend service.",
      });
      onSyncFailure();
    }
  };

  const handleClearResult = () => {
    // Clearing the result also removes the shared Dashboard fallback cache.
    clearCachedUploadAnalysis();
    setAnalysis(null);
    setRows([]);
    setSelectedRow(null);
    setSelectedFile(null);
    resetFilters(1);
    setState({ type: "idle", message: "Cached analysis cleared." });
  };

  const resetFilters = (maximum = analysis?.metadata.totalRecords ?? 1) => {
    // Reset returns chart/table filters to the complete analyzed row range reported by the backend.
    setQuery("");
    setFilter("all");
    setSort("priority");
    setProtocolFilter(null);
    setSelectedProbabilityBucket(null);
    setProbabilityMin(0);
    setProbabilityMax(100);
    setRowStart(1);
    setRowEnd(maximum);
  };

  const selectCategory = (label: string) => {
    const next: FilterOption =
      label === "Attack" ? "attack" : label === "Review Recommended" ? "review" : "normal";
    setFilter((current) => current === next ? "all" : next);
  };

  const selectProtocol = (
    protocol: string,
    category?: "Normal" | "Review Recommended" | "Attack",
  ) => {
    setProtocolFilter((current) => current === protocol ? null : protocol);
    if (category) selectCategory(category);
  };

  const selectProbabilityBucket = (label: string) => {
    if (selectedProbabilityBucket === label) {
      setSelectedProbabilityBucket(null);
      setProbabilityMin(0);
      setProbabilityMax(100);
      return;
    }
    const [minimum, maximum] = parseProbabilityBucket(label);
    setSelectedProbabilityBucket(label);
    setProbabilityMin(minimum);
    setProbabilityMax(maximum);
  };

  const selectRiskRange = (label: string) => {
    const point = analysis?.charts.trend.find((item) => item.label === label);
    if (!point) return;
    const alreadySelected = rowStart === point.startRow && rowEnd === point.endRow;
    setRowStart(alreadySelected ? 1 : point.startRow);
    setRowEnd(alreadySelected ? analysis?.metadata.totalRecords ?? 1 : point.endRow);
  };

  return (
    <div className="upload-dashboard-page">
      <div className="upload-investigation-layout">
        <div className="upload-investigation-main">
          <section className="panel upload-command-card">
            <div className="upload-command-main">
              <div className="upload-command-heading">
                <h3>Upload network traffic CSV</h3>
                {hasAnalysis ? (
                  <button type="button" className="upload-clear-button" onClick={handleClearResult} disabled={state.type === "loading"}>
                    Clear result
                  </button>
                ) : null}
              </div>
              <UploadBox file={selectedFile} onSelectFile={setSelectedFile} disabled={state.type === "loading"} />
              {restoredCacheActive && analysis ? (
                <div className="cached-analysis-callout">
                  <strong>Restored cached analysis</strong>
                  <span>{analysis.summary.filename}</span>
                  <small>Generated {formatDisplayDate(analysis.summary.updatedAt)}. Choose a new CSV to replace this analysis.</small>
                </div>
              ) : null}
            </div>

            <div className="upload-command-actions">
              <button type="button" className="primary-button upload-analyse-button" onClick={handleAnalyze} disabled={state.type === "loading"}>
                {state.type === "loading" ? "Analysing..." : "Analyse file"}
              </button>
              <button type="button" className="secondary-button" onClick={exportCsvTemplate} disabled={state.type === "loading"}>
                Download template
              </button>
            </div>

            <div className="upload-validation-panel">
              <ValidationItem label="Required columns" status={state.type === "success" ? "ready" : "pending"} />
              <ValidationItem label="Numeric values" status={state.type === "success" ? "ready" : "pending"} />
              <ValidationItem label="File size" status={selectedFile && selectedFile.size <= 25 * 1024 * 1024 ? "ready" : selectedFile ? "error" : "pending"} />
              <div className={`upload-result-message upload-result-${state.type}`}>
                {state.message}
              </div>
            </div>
          </section>

          {!hasAnalysis ? (
            <EmptyState
              title="Upload a network traffic file to generate prediction charts and analysis."
              description="Charts and results remain hidden until the FastAPI backend completes a real model analysis."
            />
          ) : null}

          {analysis ? (
            <>
              <section className="upload-kpi-grid">
                <KpiCard label="Records analysed" value={analysis.summary.totalRecords.toLocaleString()} helper={`${analysis.metadata.returnedRecords.toLocaleString()} preview rows returned`} tone="info" icon="≡" />
                <KpiCard label="Normal" value={analysis.summary.normalRecords.toLocaleString()} helper={formatShare(analysis.summary.normalRecords, analysis.summary.totalRecords)} tone="normal" icon="✓" />
                <KpiCard label="Review recommended" value={analysis.summary.suspiciousRecords.toLocaleString()} helper={formatShare(analysis.summary.suspiciousRecords, analysis.summary.totalRecords)} tone="suspicious" icon="◉" />
                <KpiCard label="Attack detected" value={analysis.summary.attackRecords.toLocaleString()} helper={formatShare(analysis.summary.attackRecords, analysis.summary.totalRecords)} tone="attack" icon="!" />
                <KpiCard label="Avg attack probability" value={`${estimatedAverageAttackProbability}%`} helper="Estimated from all probability buckets" tone="suspicious" icon="%" />
                <KpiCard label="Model used" value={formatModelName(analysis.modelAnalysis.bestModel)} helper="Primary deployed classifier" tone="model" icon="AI" />
              </section>

              <div className="review-class-note">
                <span>i</span>
                Review recommended is probability-based and is not a third model class.
              </div>
              {analysis.metadata.preprocessingMode === "manual_fallback" ? (
                <div className="preprocessing-warning" role="status">
                  {analysis.metadata.preprocessingWarning}
                </div>
              ) : null}

              <section className="panel upload-filter-toolbar">
                <label className="compact-filter-control">
                  <span>Protocol</span>
                  <select value={protocolFilter ?? ""} onChange={(event) => setProtocolFilter(event.target.value || null)}>
                    <option value="">All protocols</option>
                    {uniqueProtocols.map((protocol) => <option key={protocol} value={protocol}>{protocol}</option>)}
                  </select>
                </label>

                <div className="compact-filter-control upload-category-filter">
                  <span>Display category</span>
                  <div className="chip-row">
                    {(["all", "normal", "review", "attack"] as FilterOption[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`chip chip-${option} ${filter === option ? "chip-active" : ""}`}
                        onClick={() => setFilter(option)}
                      >
                        {option === "all" ? "All" : option === "review" ? "Review recommended" : option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="compact-filter-control probability-range-control">
                  <span>Probability range</span>
                  <div className="dual-range-labels">
                    <strong>{probabilityMin}%</strong>
                    <strong>{probabilityMax}%</strong>
                  </div>
                  <div className="dual-range-inputs">
                    <input type="range" min="0" max="100" value={probabilityMin} onChange={(event) => {
                      setSelectedProbabilityBucket(null);
                      setProbabilityMin(Math.min(Number(event.target.value), probabilityMax));
                    }} />
                    <input type="range" min="0" max="100" value={probabilityMax} onChange={(event) => {
                      setSelectedProbabilityBucket(null);
                      setProbabilityMax(Math.max(Number(event.target.value), probabilityMin));
                    }} />
                  </div>
                </div>

                <div className="compact-filter-control">
                  <span>Row range</span>
                  <div className="row-range-inputs">
                    <input type="number" min="1" max={analysis.metadata.totalRecords} value={rowStart} onChange={(event) => setRowStart(clamp(Number(event.target.value), 1, rowEnd))} />
                    <span>to</span>
                    <input type="number" min={rowStart} max={analysis.metadata.totalRecords} value={rowEnd} onChange={(event) => setRowEnd(clamp(Number(event.target.value), rowStart, analysis.metadata.totalRecords))} />
                  </div>
                </div>

                <div className="upload-filter-actions">
                  <button type="button" className="secondary-button" onClick={() => resetFilters()}>
                    Reset filters
                  </button>
                  <button type="button" className="secondary-button" onClick={() => exportUploadRows(filteredRows, analysis)}>
                    Export CSV
                  </button>
                  <button type="button" className="secondary-button" onClick={() => exportUploadAnalysisJson(analysis, filteredRows)}>
                    Export JSON
                  </button>
                </div>
              </section>

              <section className="upload-chart-workspace">
                <nav className="upload-analysis-tabs" aria-label="Upload analysis sections">
                  <button type="button" className="upload-analysis-tab upload-analysis-tab-active" onClick={() => document.getElementById("upload-overview")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Overview</button>
                  <button type="button" className="upload-analysis-tab" onClick={() => document.getElementById("upload-risk-trend")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Risk Trend</button>
                  <button type="button" className="upload-analysis-tab" onClick={() => document.getElementById("upload-feature-explorer")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Feature Explorer</button>
                  <button type="button" className="upload-analysis-tab" onClick={() => document.getElementById("upload-protocol-risk")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Protocol Risk</button>
                  <button type="button" className="upload-analysis-tab" onClick={() => document.getElementById("upload-probability")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Probability</button>
                </nav>
                <div className="upload-chart-grid upload-chart-grid-primary">
                  <div id="upload-overview" className="upload-chart-cell">
                    <ChartInsightCard
                      title="A. Prediction distribution"
                      subtitle="Normal, review, and attack composition."
                      question="Which traffic category dominates this upload?"
                      meaning="This chart separates the uploaded traffic into model-normal rows, probability-based review rows, and attack rows."
                      insight={`${analysis.summary.normalRecords.toLocaleString()} normal, ${analysis.summary.suspiciousRecords.toLocaleString()} review recommended, and ${analysis.summary.attackRecords.toLocaleString()} attack rows.`}
                      interaction="Hover for counts. Click a slice to filter the table and every linked chart."
                      filename="prediction-distribution.png"
                    >
                      <D3PieChart
                        segments={analysis.charts.composition}
                        centerLabel="Total"
                        centerValue={analysis.summary.totalRecords.toLocaleString()}
                        selectedLabel={filter === "attack" ? "Attack" : filter === "review" ? "Review Recommended" : filter === "normal" ? "Normal" : null}
                        onSelect={selectCategory}
                      />
                    </ChartInsightCard>
                  </div>
                  <div id="upload-risk-trend" className="upload-chart-cell">
                    <ChartInsightCard
                      title="B. Grouped anomaly-risk trend"
                      subtitle="Average and maximum attack probability across row ranges."
                      question="Which row ranges show higher attack probability?"
                      meaning="The line shows probability movement across the upload, while red bars show attack concentration in each row bucket."
                      insight={buildTrendInsight(analysis)}
                      interaction="Scroll to zoom, drag to pan, or click a row bucket to filter the table."
                      filename="anomaly-risk-trend.png"
                      wide
                    >
                      <D3RiskTrendChart
                        data={analysis.charts.trend}
                        reviewThreshold={analysis.metadata.reviewThreshold}
                        attackThreshold={analysis.metadata.attackThreshold}
                        selectedRange={analysis.charts.trend.find((point) => point.startRow === rowStart && point.endRow === rowEnd)?.label ?? null}
                        onSelectRange={selectRiskRange}
                      />
                    </ChartInsightCard>
                  </div>
                </div>

                <div className="upload-chart-grid upload-chart-grid-secondary">
                  <div id="upload-feature-explorer" className="upload-chart-cell">
                    <ChartInsightCard
                      title="C. Traffic feature explorer"
                      subtitle="Feature separation for the currently filtered preview rows."
                      question="Which traffic features separate normal and risky records?"
                      meaning="Each point is a returned preview row. Size follows attack probability and color follows display category."
                      insight={`Showing ${filteredRows.length.toLocaleString()} filtered preview rows from the capped response.`}
                      interaction="Choose axes, hover points, zoom/pan, and click a point to inspect the row."
                      filename="traffic-feature-explorer.png"
                    >
                      <div className="chart-axis-controls">
                        <label>X-axis<select value={xFeature} onChange={(event) => setXFeature(event.target.value as ScatterFeature)}>{Object.entries(scatterFeatureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label>Y-axis<select value={yFeature} onChange={(event) => setYFeature(event.target.value as ScatterFeature)}>{Object.entries(scatterFeatureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      </div>
                      <D3ScatterPlot rows={filteredRows} xFeature={xFeature} yFeature={yFeature} selectedRow={selectedRow} onSelectRow={selectRow} />
                    </ChartInsightCard>
                  </div>
                  <div id="upload-protocol-risk" className="upload-chart-cell">
                    <ChartInsightCard
                      title="D. Protocol risk comparison"
                      subtitle="Stacked category counts by protocol."
                      question="Which protocols contain more review or attack records?"
                      meaning="Bars compare Normal, Review Recommended, and Attack records within each protocol found in the upload."
                      insight={buildProtocolInsight(analysis)}
                      interaction="Sort by risk, hover for proportions, or click a segment to filter protocol and category."
                      filename="protocol-risk.png"
                    >
                      <D3ProtocolRiskChart data={analysis.charts.protocolRisk} selectedProtocol={protocolFilter} onSelect={selectProtocol} />
                    </ChartInsightCard>
                  </div>
                  <div id="upload-probability" className="upload-chart-cell">
                    <ChartInsightCard
                      title="E. Attack-probability distribution"
                      subtitle="Record frequency across model risk ranges."
                      question="How confident is the model that rows are attack-like?"
                      meaning="Buckets show how many rows fall into each attack-probability band. Threshold markers show review and attack cutoffs."
                      insight={`Estimated average attack probability is ${estimatedAverageAttackProbability}% across all analysed rows.`}
                      interaction="Hover for bucket details or click a bar to filter the preview table."
                      filename="attack-probability-distribution.png"
                    >
                      <D3ProbabilityHistogram
                        data={analysis.charts.probabilityBuckets}
                        reviewThreshold={analysis.metadata.reviewThreshold}
                        attackThreshold={analysis.metadata.attackThreshold}
                        selectedLabel={selectedProbabilityBucket}
                        onSelect={selectProbabilityBucket}
                      />
                    </ChartInsightCard>
                  </div>
                </div>
              </section>

              <section className="upload-results-grid">
                <Panel title="Analysed result table" subtitle={`Showing the returned ${analysis.metadata.previewCapped ? "preview" : "result set"}.`}>
                  <div className="table-control-grid upload-table-controls">
                    <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search row, IP, protocol, service, or category" />
                    <label className="control-label">Sort<select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}><option value="priority">Threat priority</option><option value="record">Row number</option><option value="confidence">Confidence</option><option value="attackProbability">Attack probability</option></select></label>
                    <label className="control-label">Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as typeof pageSize)}>{pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  </div>

                  <div className="table-count-bar">
                    <span>Showing {filteredRows.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageSize, filteredRows.length)} of {filteredRows.length.toLocaleString()} filtered preview rows</span>
                    <span>{analysis.metadata.returnedRecords.toLocaleString()} of {analysis.metadata.totalRecords.toLocaleString()} records returned</span>
                  </div>

                  <div className="panel-table-wrap">
                    {state.type === "loading" ? <LoadingOverlay message="Processing model predictions..." /> : null}
                    <DataTable
                      columns={columns}
                      rows={paginatedRows}
                      rowKey={(row) => row.rowId}
                      onRowClick={(row) => selectRow(row.recordNumber)}
                      rowClassName={(row) => [
                        row.prediction === "Review Recommended" ? "table-row-suspicious" : row.prediction === "Attack" ? "table-row-attack" : "",
                        row.recordNumber === selectedRow ? "table-row-selected" : "",
                      ].filter(Boolean).join(" ")}
                      emptyState={<EmptyState title="No matching records" description="Adjust or reset the active filters." />}
                    />
                  </div>

                  <div className="pagination-row">
                    <button type="button" className="secondary-button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1}>Previous</button>
                    <span>Page {safePage} of {totalPages}</span>
                    <button type="button" className="secondary-button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages}>Next</button>
                  </div>
                </Panel>

                <Panel title="Highest-risk preview records" subtitle="Fast access to rows requiring attention.">
                  <div className="risky-record-list">
                    {sortRows(rows, "attackProbability").slice(0, 5).map((row) => (
                      <button key={row.rowId} type="button" className="risky-record-item" onClick={() => selectRow(row.recordNumber)}>
                        <span className={`risk-dot risk-dot-${row.prediction === "Attack" ? "attack" : row.prediction === "Review Recommended" ? "review" : "normal"}`} />
                        <span><strong>{row.rowId}</strong><small>{row.protocol} · {row.service.toUpperCase()}</small></span>
                        <span><strong>{row.attackProbability}%</strong><small>{row.prediction}</small></span>
                      </button>
                    ))}
                  </div>
                </Panel>
              </section>

              <Panel title="Dataset model analysis" subtitle="Per-model behaviour for the uploaded dataset.">
                <div className="model-analysis-summary">
                  <MetaItem label="Best model" value={formatModelName(analysis.modelAnalysis.bestModel)} />
                  <MetaItem label="Highest recall" value={formatModelName(analysis.modelAnalysis.highestRecallModel)} />
                  <MetaItem label="Highest F1-score" value={formatModelName(analysis.modelAnalysis.highestF1Model)} />
                  <MetaItem label="Labels" value={analysis.modelAnalysis.labelsAvailable ? "Available" : "Not available"} />
                </div>
                {!analysis.modelAnalysis.labelsAvailable ? (
                  <p className="chart-note">Ground-truth labels were not found, so accuracy-based evaluation is unavailable. Prediction distribution remains available without inventing accuracy.</p>
                ) : null}
                <div className="analytics-grid model-analysis-grid">
                  {analysis.modelAnalysis.charts.performance.length > 0 ? <ExportableChartPanel title="Model performance" filename="dataset-model-performance.png"><D3BarChart data={analysis.modelAnalysis.charts.performance} height={320} /></ExportableChartPanel> : null}
                  <ExportableChartPanel title="Prediction distribution" filename="model-prediction-distribution.png"><D3BarChart data={analysis.modelAnalysis.charts.predictionDistribution} height={300} /></ExportableChartPanel>
                  {analysis.modelAnalysis.labelsAvailable && analysis.modelAnalysis.models[0]?.confusionMatrix.length ? <ExportableChartPanel title="Confusion matrix" filename="dataset-confusion-matrix.png"><D3HeatmapChart data={analysis.modelAnalysis.models[0].confusionMatrix} /></ExportableChartPanel> : null}
                </div>
                <div className="panel-table-wrap model-table-wrap">
                  <DataTable columns={modelColumns} rows={analysis.modelAnalysis.models} rowKey={(row) => row.modelName} />
                </div>
              </Panel>
            </>
          ) : null}
        </div>

      </div>
    </div>
  );
}

function ValidationItem({ label, status }: { label: string; status: "ready" | "pending" | "error" }) {
  return (
    <div className={`validation-item validation-${status}`}>
      <span>{status === "ready" ? "✓" : status === "error" ? "!" : "·"}</span>
      <strong>{label}</strong>
      <small>{status === "ready" ? "OK" : status === "error" ? "Check" : "Pending"}</small>
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  tone,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "info" | "normal" | "suspicious" | "attack" | "model";
  icon: string;
}) {
  return (
    <article className={`upload-kpi-card upload-kpi-${tone}`}>
      <span className="upload-kpi-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function ChartInsightCard({
  title,
  subtitle,
  question,
  meaning,
  insight,
  interaction,
  filename,
  wide = false,
  children,
}: {
  title: string;
  subtitle: string;
  question: string;
  meaning: string;
  insight: string;
  interaction: string;
  filename: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`chart-insight-export-wrap ${wide ? "chart-insight-export-wide" : ""}`}
      data-chart-export-card
    >
      <Panel
        title={title}
        subtitle={subtitle}
        aside={(
          <button
            type="button"
            className="chart-action-button chart-card-export-button"
            data-export-hidden="true"
            onClick={(event) => exportChartCardAsPng(event.currentTarget, filename)}
          >
            Export PNG
          </button>
        )}
      >
        <div className="chart-insight-layout">
          <aside className="chart-insight-panel">
            <span>Question</span>
            <strong>{question}</strong>
            <p>{meaning}</p>
            <div className="chart-insight-highlight">
              <small>Key insight</small>
              <b>{insight}</b>
            </div>
            <em>{interaction}</em>
          </aside>
          <div className="chart-insight-visual">
            {children}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return <div className="result-meta-item"><span>{label}</span><strong>{value}</strong></div>;
}

function sortRows(rows: UploadAnalysisRow[], sort: SortOption) {
  return [...rows].sort((left, right) => {
    if (sort === "record") return left.recordNumber - right.recordNumber;
    if (sort === "confidence") return right.confidence - left.confidence || left.recordNumber - right.recordNumber;
    if (sort === "attackProbability") return right.attackProbability - left.attackProbability || left.recordNumber - right.recordNumber;
    return getPriority(right) - getPriority(left) || right.attackProbability - left.attackProbability || left.recordNumber - right.recordNumber;
  });
}

function getPriority(row: UploadAnalysisRow) {
  if (row.prediction === "Attack") return 2;
  if (row.prediction === "Review Recommended") return 1;
  return 0;
}

function parseProbabilityBucket(bucket: string): [number, number] {
  const [startText, endText] = bucket.replace(/%/g, "").split("-");
  return [Number(startText), Number(endText)];
}

function formatShare(value: number, total: number) {
  return `${total > 0 ? ((value / total) * 100).toFixed(2) : "0.00"}% of total`;
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function estimateAverageProbability(
  buckets: UploadAnalysisResult["charts"]["probabilityBuckets"],
) {
  const bucketMidpoints: Record<string, number> = {
    "0-20%": 10,
    "21-40%": 30,
    "41-60%": 50,
    "61-80%": 70,
    "81-100%": 90,
  };
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  if (total === 0) return 0;

  const weighted = buckets.reduce(
    (sum, bucket) => sum + (bucketMidpoints[bucket.label] ?? 50) * bucket.value,
    0,
  );
  return Math.round(weighted / total);
}

function buildTrendInsight(analysis: UploadAnalysisResult) {
  const highestBucket = [...analysis.charts.trend].sort(
    (left, right) => right.maximumAttackProbability - left.maximumAttackProbability,
  )[0];
  if (!highestBucket) {
    return "No trend buckets were returned for this upload.";
  }
  return `Rows ${highestBucket.label} reached the highest probability peak at ${Math.round(highestBucket.maximumAttackProbability * 100)}%.`;
}

function buildProtocolInsight(analysis: UploadAnalysisResult) {
  const highestProtocol = [...analysis.charts.protocolRisk].sort(
    (left, right) => right.attackRate - left.attackRate || right.attack - left.attack,
  )[0];
  if (!highestProtocol) {
    return "No protocol grouping was available in this upload.";
  }
  return `${highestProtocol.protocol} has the highest attack rate at ${(highestProtocol.attackRate * 100).toFixed(1)}%.`;
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
