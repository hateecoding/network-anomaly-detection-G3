import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { UploadRiskTrendPoint } from "../utils/uploadAnalysis";
import {
  animatePathDraw,
  exportSvgAsPng,
  hideChartTooltip,
  moveChartTooltip,
  showChartTooltip,
} from "../utils/d3ChartUtils";

type D3RiskTrendChartProps = {
  data: UploadRiskTrendPoint[];
  reviewThreshold: number;
  attackThreshold: number;
  selectedRange?: string | null;
  onSelectRange?: (label: string) => void;
};

export function D3RiskTrendChart({
  data,
  reviewThreshold,
  attackThreshold,
  selectedRange = null,
  onSelectRange,
}: D3RiskTrendChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!ref.current || data.length === 0) {
      return;
    }

    const width = 920;
    const height = 360;
    const margin = { top: 34, right: 64, bottom: 62, left: 60 };
    const plotBottom = height - margin.bottom;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const clipId = `risk-clip-${Math.random().toString(36).slice(2)}`;
    svg.append("defs").append("clipPath").attr("id", clipId)
      .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", width - margin.left - margin.right)
      .attr("height", plotBottom - margin.top);

    const baseX = d3
      .scaleLinear()
      .domain([0, Math.max(1, data.length - 1)])
      .range([margin.left, width - margin.right]);
    const probabilityY = d3.scaleLinear().domain([0, 1]).range([plotBottom, margin.top]);
    const countY = d3
      .scaleLinear()
      .domain([0, d3.max(data, (point) => point.attack) ?? 1])
      .nice()
      .range([plotBottom, margin.top]);
    const barWidth = Math.max(8, (width - margin.left - margin.right) / Math.max(data.length, 1) * 0.48);

    svg
      .append("rect")
      .attr("x", margin.left)
      .attr("y", probabilityY(attackThreshold))
      .attr("width", width - margin.left - margin.right)
      .attr("height", probabilityY(reviewThreshold) - probabilityY(attackThreshold))
      .attr("fill", "rgba(251, 191, 36, 0.08)");

    const plot = svg.append("g").attr("clip-path", `url(#${clipId})`);
    const bars = plot
      .append("g")
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (_point, index) => baseX(index) - barWidth / 2)
      .attr("y", countY(0))
      .attr("width", barWidth)
      .attr("height", 0)
      .attr("rx", 4)
      .attr("fill", "#ef4444")
      .attr("opacity", (point) =>
        selectedRange && selectedRange !== point.label ? 0.2 : 0.66
      )
      .style("cursor", onSelectRange ? "pointer" : "default")
      .on("pointerenter", (event: PointerEvent, point) =>
        showChartTooltip(event, `Rows ${point.label}`, [
          `${point.totalRecords.toLocaleString()} records`,
          `Average probability: ${(point.averageAttackProbability * 100).toFixed(1)}%`,
          `Maximum probability: ${(point.maximumAttackProbability * 100).toFixed(1)}%`,
          `Attack: ${point.attack.toLocaleString()}`,
          `Review recommended: ${point.reviewRecommended.toLocaleString()}`,
          `Most common protocol: ${point.mostCommonProtocol ?? "Unknown"}`,
          "Click to filter this row range",
        ]),
      )
      .on("pointermove", (event: PointerEvent) => moveChartTooltip(event))
      .on("pointerleave", hideChartTooltip)
      .on("click", (_event, point) => onSelectRange?.(point.label));

    bars
      .transition()
      .duration(620)
      .ease(d3.easeCubicOut)
      .attr("y", (point) => countY(point.attack))
      .attr("height", (point) => countY(0) - countY(point.attack));

    const line = d3
      .line<UploadRiskTrendPoint>()
      .x((_point, index) => baseX(index))
      .y((point) => probabilityY(point.averageAttackProbability))
      .curve(d3.curveMonotoneX);
    const maxLine = d3
      .line<UploadRiskTrendPoint>()
      .x((_point, index) => baseX(index))
      .y((point) => probabilityY(point.maximumAttackProbability))
      .curve(d3.curveMonotoneX);

    const averagePath = plot
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 2.5)
      .attr("d", line);
    const maximumPath = plot
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#fb923c")
      .attr("stroke-width", 2.5)
      .attr("d", maxLine);
    animatePathDraw(averagePath as d3.Selection<SVGPathElement, unknown, null, undefined>);
    animatePathDraw(maximumPath as d3.Selection<SVGPathElement, unknown, null, undefined>, 760);

    for (const [threshold, color, label] of [
      [reviewThreshold, "#fbbf24", "Review threshold"],
      [attackThreshold, "#ef4444", "Attack threshold"],
    ] as const) {
      svg
        .append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", probabilityY(threshold))
        .attr("y2", probabilityY(threshold))
        .attr("stroke", color)
        .attr("stroke-dasharray", "6 5");
      svg
        .append("text")
        .attr("class", "d3-value-label")
        .attr("x", width - margin.right - 4)
        .attr("y", probabilityY(threshold) - 6)
        .attr("text-anchor", "end")
        .text(`${label} ${Math.round(threshold * 100)}%`);
    }

    const xAxis = svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(0,${plotBottom})`);
    const probabilityAxis = svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(probabilityY).ticks(5).tickFormat((value) => `${Number(value) * 100}%`));
    probabilityAxis.call((group) => group.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(${width - margin.right},0)`)
      .call(d3.axisRight(countY).ticks(5))
      .call((group) => group.select(".domain").remove());

    const updateXAxis = (scale: d3.ScaleLinear<number, number>) => {
      const visibleTicks = Math.min(8, data.length);
      const ticks = d3.range(visibleTicks).map((index) =>
        (data.length - 1) * (index / Math.max(1, visibleTicks - 1)),
      );
      xAxis
        .call(
          d3.axisBottom(scale)
            .tickValues(ticks)
            .tickFormat((value) => data[Math.max(0, Math.min(data.length - 1, Math.round(Number(value))))]?.label ?? ""),
        )
        .selectAll("text")
        .attr("transform", "rotate(-24)")
        .style("text-anchor", "end");
      xAxis.select(".domain").remove();
    };
    updateXAxis(baseX);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
      .translateExtent([[margin.left, 0], [width - margin.right, height]])
      .extent([[margin.left, margin.top], [width - margin.right, plotBottom]])
      .on("zoom", (event) => {
        const transformedX = event.transform.rescaleX(baseX);
        updateXAxis(transformedX);
        bars.attr("x", (_point, index) => transformedX(index) - barWidth / 2);
        averagePath.attr(
          "d",
          d3.line<UploadRiskTrendPoint>()
            .x((_point, index) => transformedX(index))
            .y((point) => probabilityY(point.averageAttackProbability))
            .curve(d3.curveMonotoneX),
        );
        maximumPath.attr(
          "d",
          d3.line<UploadRiskTrendPoint>()
            .x((_point, index) => transformedX(index))
            .y((point) => probabilityY(point.maximumAttackProbability))
            .curve(d3.curveMonotoneX),
        );
      });
    zoomRef.current = zoom;
    svg.call(zoom);
  }, [attackThreshold, data, onSelectRange, reviewThreshold, selectedRange]);

  return (
    <div className="chart-shell">
      <div className="chart-action-row">
        <div className="chart-legend">
          <span className="chart-legend-item"><span className="chart-legend-dot" style={{ backgroundColor: "#60a5fa" }} />Average probability</span>
          <span className="chart-legend-item"><span className="chart-legend-dot" style={{ backgroundColor: "#fb923c" }} />Maximum probability</span>
          <span className="chart-legend-item"><span className="chart-legend-dot" style={{ backgroundColor: "#ef4444" }} />Attack count</span>
        </div>
        <div className="chart-action-buttons">
          <button
            type="button"
            className="chart-action-button"
            onClick={() => {
              if (ref.current && zoomRef.current) {
                d3.select(ref.current).transition().duration(350).call(
                  zoomRef.current.transform,
                  d3.zoomIdentity,
                );
              }
            }}
          >
            Reset zoom
          </button>
          <button type="button" className="chart-action-button" onClick={() => exportSvgAsPng(ref.current, "anomaly-risk-trend.png")}>
            Export PNG
          </button>
        </div>
      </div>
      <svg ref={ref} className="d3-chart" role="img" aria-label="Grouped anomaly risk trend" />
    </div>
  );
}
