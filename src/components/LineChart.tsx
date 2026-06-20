import { useEffect, useRef } from "react";

type DataPoint = {
  label: string;
  value: number;
};

type LineSeries = {
  key: string;
  label: string;
  color: string;
  values: DataPoint[];
};

type LineChartProps = {
  series: LineSeries[];
  height?: number;
};

export function LineChart({ series, height = 260 }: LineChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const width = 560;
  const margin = { top: 14, right: 18, bottom: 30, left: 42 };

  useEffect(() => {
    if (!ref.current || series.length === 0) {
      return;
    }

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const labels = series[0]?.values.map((item) => item.label) ?? [];
    const maxValue =
      d3.max(series.flatMap((item) => item.values.map((point) => point.value))) ?? 1;

    const xScale = d3
      .scalePoint()
      .domain(labels)
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([0, maxValue * 1.15 || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const grid = svg.append("g");
    yScale.ticks(4).forEach((tick: number) => {
      grid
        .append("line")
        .attr("class", "d3-grid-line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", yScale(tick))
        .attr("y2", yScale(tick));
    });

    const xAxis = d3.axisBottom(xScale).tickSize(0);
    const yAxis = d3.axisLeft(yScale).ticks(4).tickSize(0);

    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .call((group: any) => group.select(".domain").remove());

    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(yAxis)
      .call((group: any) => group.select(".domain").remove());

    const lineBuilder = d3
      .line()
      .x((point: DataPoint) => xScale(point.label) ?? margin.left)
      .y((point: DataPoint) => yScale(point.value))
      .curve(d3.curveMonotoneX);

    series.forEach((item) => {
      svg
        .append("path")
        .datum(item.values)
        .attr("class", "d3-line-path")
        .attr("fill", "none")
        .attr("stroke", item.color)
        .attr("stroke-width", 2.5)
        .attr("d", lineBuilder);

      svg
        .append("g")
        .selectAll("circle")
        .data(item.values)
        .enter()
        .append("circle")
        .attr("cx", (point: DataPoint) => xScale(point.label) ?? margin.left)
        .attr("cy", (point: DataPoint) => yScale(point.value))
        .attr("r", 3.5)
        .attr("fill", item.color);
    });
  }, [height, margin.bottom, margin.left, margin.right, margin.top, series, width]);

  return (
    <div className="chart-shell">
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.key} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <svg ref={ref} className="d3-chart" role="img" aria-label="Trend chart" />
    </div>
  );
}
