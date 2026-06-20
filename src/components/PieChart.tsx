import { useEffect, useRef } from "react";

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
};

export function PieChart({
  segments,
  centerLabel,
  centerValue,
  size = 240,
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
      .pie()
      .sort(null)
      .value((item: PieSegment) => item.value);

    const arc = d3.arc().innerRadius(radius * 0.62).outerRadius(radius - 6);

    group
      .selectAll("path")
      .data(pie(segments))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (item: any) => item.data.color)
      .attr("stroke", "#09111f")
      .attr("stroke-width", 3);
  }, [segments, size]);

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
      </div>
    </div>
  );
}
