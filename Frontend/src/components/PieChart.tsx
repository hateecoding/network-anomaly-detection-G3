import { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  exportSvgAsPng,
  hideChartTooltip,
  moveChartTooltip,
  showChartTooltip,
} from "../utils/d3ChartUtils";

type PieSegment = {
  label: string;
  value: number;
  color: string;
};

type PieChartProps = {
  segments: PieSegment[];
  centerLabel: string;
  centerValue: string;
  size?: number;
  onSelect?: (label: string) => void;
  selectedLabel?: string | null;
};

export function PieChart({
  segments,
  centerLabel,
  centerValue,
  size = 240,
  onSelect,
  selectedLabel = null,
}: PieChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || segments.length === 0) {
      return;
    }

    const radius = size / 2;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${size} ${size}`);

    const group = svg
      .append("g")
      .attr("transform", `translate(${radius},${radius})`);

    const pie = d3
      .pie<PieSegment>()
      .sort(null)
      .value((item: PieSegment) => item.value);

    const arc = d3
      .arc<d3.PieArcDatum<PieSegment>>()
      .innerRadius(radius * 0.62)
      .outerRadius(radius - 6);

    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    const collapsedArc = d3
      .arc<d3.PieArcDatum<PieSegment>>()
      .innerRadius(radius * 0.62)
      .outerRadius(radius * 0.62);
    const paths = group
      .selectAll("path")
      .data(pie(segments))
      .enter()
      .append("path")
      .attr("d", collapsedArc)
      .attr("fill", (item) => item.data.color)
      .attr("stroke", "#09111f")
      .attr("stroke-width", 3)
      .attr("opacity", (item) =>
        selectedLabel && selectedLabel !== item.data.label ? 0.35 : 1
      )
      .style("cursor", onSelect ? "pointer" : "default")
      .on("pointerenter", (event: PointerEvent, item) => {
        const percentage = total > 0 ? (item.data.value / total) * 100 : 0;
        showChartTooltip(event, item.data.label, [
          `${item.data.value.toLocaleString()} records`,
          `${percentage.toFixed(1)}% of analysed traffic`,
          "Click to filter the workspace",
        ]);
      })
      .on("pointermove", (event: PointerEvent) => moveChartTooltip(event))
      .on("pointerleave", hideChartTooltip)
      .on("click", (_event: MouseEvent, item) => onSelect?.(item.data.label))
      .transition()
      .duration(650)
      .ease(d3.easeCubicOut)
      .attrTween("d", (item) => {
        const interpolate = d3.interpolate(
          { startAngle: item.startAngle, endAngle: item.startAngle },
          item,
        );
        return (time) => arc(interpolate(time)) ?? "";
      });
  }, [onSelect, segments, selectedLabel, size]);

  return (
    <div className="pie-chart-shell">
      <div className="pie-chart-wrap">
        <svg ref={ref} className="pie-chart" role="img" aria-label="Detection distribution chart" />
        <div className="pie-chart-center">
          <span>{centerLabel}</span>
          <strong>{centerValue}</strong>
        </div>
      </div>
      <div className="pie-chart-legend">
        {segments.map((segment) => (
          <div key={segment.label} className="pie-chart-legend-item">
            <span
              className="pie-chart-legend-dot"
              style={{ backgroundColor: segment.color }}
            />
            <div>
              <strong>{segment.label}</strong>
              <span>{segment.value.toLocaleString()} rows</span>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="chart-action-button"
          onClick={() => exportSvgAsPng(ref.current, "prediction-distribution.png")}
        >
          Export PNG
        </button>
      </div>
    </div>
  );
}
