import { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  exportChartCardAsPng,
  hideChartTooltip,
  moveChartTooltip,
  showChartTooltip,
} from "../utils/d3ChartUtils";

type ProbabilityBucket = {
  label: string;
  value: number;
  color: string;
};

type D3ProbabilityHistogramProps = {
  data: ProbabilityBucket[];
  reviewThreshold: number;
  attackThreshold: number;
  selectedLabel?: string | null;
  onSelect: (label: string) => void;
};

export function D3ProbabilityHistogram({
  data,
  reviewThreshold,
  attackThreshold,
  selectedLabel = null,
  onSelect,
}: D3ProbabilityHistogramProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || data.length === 0) return;

    const width = 680;
    const height = 320;
    const margin = { top: 50, right: 24, bottom: 56, left: 64 };
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const total = data.reduce((sum, item) => sum + item.value, 0);

    const x = d3.scaleBand()
      .domain(data.map((item) => item.label))
      .range([margin.left, width - margin.right])
      .padding(0.18);
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, (item) => item.value) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg.append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((group) => group.select(".domain").remove());
    svg.append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((group) => group.select(".domain").remove());

    svg.append("g")
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (item) => x(item.label) ?? margin.left)
      .attr("y", y(0))
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("rx", 7)
      .attr("fill", (item) => item.color)
      .attr("opacity", (item) => selectedLabel && selectedLabel !== item.label ? 0.28 : 0.92)
      .style("cursor", "pointer")
      .on("pointerenter", (event: PointerEvent, item) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        showChartTooltip(event, `${item.label} attack probability`, [
          `${item.value.toLocaleString()} records`,
          `${percentage.toFixed(1)}% of analysed traffic`,
          "Click to filter this probability range",
        ]);
      })
      .on("pointermove", (event: PointerEvent) => moveChartTooltip(event))
      .on("pointerleave", hideChartTooltip)
      .on("click", (_event, item) => onSelect(item.label))
      .transition()
      .duration(620)
      .ease(d3.easeCubicOut)
      .attr("y", (item) => y(item.value))
      .attr("height", (item) => y(0) - y(item.value));

    const thresholds = [
      [reviewThreshold, "#fbbf24", "Review"],
      [attackThreshold, "#ef4444", "Attack"],
    ] as const;
    const thresholdPositions = thresholds.map(
      ([threshold]) => margin.left + threshold * (width - margin.left - margin.right),
    );
    const labelsAreClose = Math.abs(thresholdPositions[0] - thresholdPositions[1]) < 110;

    thresholds.forEach(([threshold, color, label], index) => {
      const xPosition = margin.left + threshold * (width - margin.left - margin.right);
      svg.append("line")
        .attr("x1", xPosition)
        .attr("x2", xPosition)
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5 5");

      const text = `${label} ${Math.round(threshold * 100)}%`;
      const textWidth = text.length * 6.6 + 12;
      const labelX = xPosition + (labelsAreClose ? (index === 0 ? -6 : 6) : 0);
      const labelY = margin.top - (labelsAreClose ? (index === 0 ? 28 : 8) : 10);
      const anchor = labelsAreClose ? (index === 0 ? "end" : "start") : "middle";
      const backgroundX = anchor === "end"
        ? labelX - textWidth
        : anchor === "start"
          ? labelX
          : labelX - textWidth / 2;
      const labelGroup = svg.append("g").attr("class", "threshold-label-group");
      labelGroup.append("rect")
        .attr("x", backgroundX)
        .attr("y", labelY - 13)
        .attr("width", textWidth)
        .attr("height", 18)
        .attr("rx", 5)
        .attr("fill", "#0d1726")
        .attr("stroke", color)
        .attr("stroke-opacity", 0.45);
      labelGroup.append("text")
        .attr("class", "d3-value-label")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("text-anchor", anchor)
        .style("fill", color)
        .text(text);
    });

    svg.append("text")
      .attr("class", "d3-value-label")
      .attr("x", 18)
      .attr("y", margin.top - 8)
      .text("Records");
  }, [attackThreshold, data, onSelect, reviewThreshold, selectedLabel]);

  return (
    <div className="chart-shell">
      <div className="chart-action-row">
        <span className="chart-note">Bars use model attack probability, not generic confidence.</span>
        <button
          type="button"
          className="chart-action-button"
          data-export-hidden="true"
          onClick={(event) => exportChartCardAsPng(event.currentTarget, "attack-probability-distribution.png")}
        >
          Export PNG
        </button>
      </div>
      <svg ref={ref} className="d3-chart" role="img" aria-label="Attack probability distribution" />
    </div>
  );
}
