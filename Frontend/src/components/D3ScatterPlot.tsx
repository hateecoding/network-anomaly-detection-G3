import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { UploadAnalysisRow } from "../data/presentationData";
import {
  exportChartCardAsPng,
  hideChartTooltip,
  moveChartTooltip,
  showChartTooltip,
} from "../utils/d3ChartUtils";

export type ScatterFeature =
  | "duration"
  | "srcBytes"
  | "dstBytes"
  | "totalBytes"
  | "byteRatio"
  | "activityCount"
  | "serviceCount"
  | "destinationHostCount"
  | "destinationHostServiceCount";

type D3ScatterPlotProps = {
  rows: UploadAnalysisRow[];
  xFeature: ScatterFeature;
  yFeature: ScatterFeature;
  selectedRow?: number | null;
  onSelectRow: (recordNumber: number) => void;
};

export const scatterFeatureLabels: Record<ScatterFeature, string> = {
  duration: "Duration",
  srcBytes: "Source bytes",
  dstBytes: "Destination bytes",
  totalBytes: "Total bytes",
  byteRatio: "Byte ratio",
  activityCount: "Activity count",
  serviceCount: "Service count",
  destinationHostCount: "Destination host count",
  destinationHostServiceCount: "Destination host service count",
};

const categoryColors: Record<UploadAnalysisRow["prediction"], string> = {
  Normal: "#34d399",
  "Review Recommended": "#fbbf24",
  Attack: "#ef4444",
};

export function D3ScatterPlot({
  rows,
  xFeature,
  yFeature,
  selectedRow = null,
  onSelectRow,
}: D3ScatterPlotProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGGElement, unknown> | null>(null);
  const zoomTargetRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!ref.current || rows.length === 0) {
      return;
    }

    const width = 800;
    const height = 430;
    const margin = { top: 18, right: 24, bottom: 62, left: 84 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const sampledRows = rows.length > 750
      ? rows.filter((_, index) => index % Math.ceil(rows.length / 750) === 0)
      : rows;
    const x = d3
      .scaleLinear()
      .domain(d3.extent(sampledRows, (row) => row[xFeature]) as [number, number])
      .nice()
      .range([0, plotWidth]);
    const y = d3
      .scaleLinear()
      .domain(d3.extent(sampledRows, (row) => row[yFeature]) as [number, number])
      .nice()
      .range([plotHeight, 0]);
    const radius = d3.scaleSqrt().domain([0, 100]).range([3, 10]);

    const clipId = `scatter-clip-${Math.random().toString(36).slice(2)}`;
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", plotWidth)
      .attr("height", plotHeight);

    const plotFrame = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    zoomTargetRef.current = plotFrame.node();
    plotFrame
      .append("rect")
      .attr("width", plotWidth)
      .attr("height", plotHeight)
      .attr("fill", "transparent")
      .style("cursor", "grab");
    const plot = plotFrame.append("g").attr("clip-path", `url(#${clipId})`);
    const xAxis = plotFrame
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(0,${plotHeight})`);
    const yAxis = plotFrame
      .append("g")
      .attr("class", "d3-axis");

    const draw = (transform: d3.ZoomTransform) => {
      const transformedX = transform.rescaleX(x);
      const transformedY = transform.rescaleY(y);
      xAxis.call(d3.axisBottom(transformedX).ticks(6).tickPadding(10));
      yAxis.call(d3.axisLeft(transformedY).ticks(6).tickPadding(10));
      plot
        .selectAll<SVGCircleElement, UploadAnalysisRow>("circle")
        .attr("cx", (row) => transformedX(row[xFeature]))
        .attr("cy", (row) => transformedY(row[yFeature]));
    };

    const points = plot
      .selectAll("circle")
      .data(sampledRows)
      .enter()
      .append("circle")
      .attr("cx", (row) => x(row[xFeature]))
      .attr("cy", (row) => y(row[yFeature]))
      .attr("r", 0)
      .attr("fill", (row) => categoryColors[row.prediction])
      .attr("fill-opacity", 0.58)
      .attr("stroke", (row) => row.recordNumber === selectedRow ? "#ffffff" : "transparent")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("pointerenter", (event: PointerEvent, row) =>
        showChartTooltip(event, row.rowId, [
          `${row.protocol} / ${row.service}`,
          `${scatterFeatureLabels[xFeature]}: ${formatNumber(row[xFeature])}`,
          `${scatterFeatureLabels[yFeature]}: ${formatNumber(row[yFeature])}`,
          `Attack probability: ${row.attackProbability}%`,
          `Model output: ${row.modelPrediction}`,
          `Display category: ${row.prediction}`,
        ]),
      )
      .on("pointermove", (event: PointerEvent) => moveChartTooltip(event))
      .on("pointerleave", hideChartTooltip)
      .on("click", (_event, row) => onSelectRow(row.recordNumber));

    points
      .transition()
      .duration(520)
      .delay((_row, index) => Math.min(index * 2, 280))
      .ease(d3.easeCubicOut)
      .attr("r", (row) => radius(row.attackProbability));

    xAxis.call(d3.axisBottom(x).ticks(6).tickPadding(10));
    yAxis.call(d3.axisLeft(y).ticks(6).tickPadding(10));
    svg
      .append("text")
      .attr("class", "d3-value-label")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 12)
      .attr("text-anchor", "middle")
      .text(scatterFeatureLabels[xFeature]);
    svg
      .append("text")
      .attr("class", "d3-value-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + height - margin.bottom) / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .text(scatterFeatureLabels[yFeature]);

    const zoom = d3
      .zoom<SVGGElement, unknown>()
      .scaleExtent([1, 64])
      .translateExtent([[0, 0], [plotWidth, plotHeight]])
      .extent([[0, 0], [plotWidth, plotHeight]])
      .on("start", () => plotFrame.select("rect").style("cursor", "grabbing"))
      .on("zoom", (event) => draw(event.transform))
      .on("end", () => plotFrame.select("rect").style("cursor", "grab"));
    zoomRef.current = zoom;
    plotFrame.call(zoom);

    return () => {
      zoomTargetRef.current = null;
    };
  }, [onSelectRow, rows, selectedRow, xFeature, yFeature]);

  return (
    <div className="chart-shell">
      <div className="chart-action-row">
        <span className="chart-note">
          {rows.length > 750
            ? "Visual sampling is active; the table retains the complete returned preview."
            : "Scroll to zoom, drag to pan, and click a point to inspect its row."}
        </span>
        <div className="chart-action-buttons">
          <button
            type="button"
            className="chart-action-button"
            data-export-hidden="true"
            onClick={() => {
              if (zoomTargetRef.current && zoomRef.current) {
                d3.select(zoomTargetRef.current)
                  .transition()
                  .duration(350)
                  .call(zoomRef.current.transform, d3.zoomIdentity);
              }
            }}
          >
            Reset zoom
          </button>
          <button
            type="button"
            className="chart-action-button"
            data-export-hidden="true"
            onClick={(event) => exportChartCardAsPng(event.currentTarget, "traffic-feature-explorer.png")}
          >
            Export PNG
          </button>
        </div>
      </div>
      <svg ref={ref} className="d3-chart" role="img" aria-label="Traffic feature and prediction scatter plot" />
    </div>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
