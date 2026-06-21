import { useEffect, useRef } from "react";

type HeatmapDatum = {
  x: string;
  y: string;
  value: number;
};

type D3HeatmapChartProps = {
  data: HeatmapDatum[];
  height?: number;
};

export function D3HeatmapChart({ data, height = 260 }: D3HeatmapChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const width = 560;
  const margin = { top: 20, right: 18, bottom: 44, left: 84 };

  useEffect(() => {
    if (!ref.current || data.length === 0) {
      return;
    }

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const xLabels = [...new Set(data.map((item) => item.x))];
    const yLabels = [...new Set(data.map((item) => item.y))];
    const maxValue = d3.max(data, (item: HeatmapDatum) => item.value) ?? 1;

    const xScale = d3
      .scaleBand()
      .domain(xLabels)
      .range([margin.left, width - margin.right])
      .padding(0.08);

    const yScale = d3
      .scaleBand()
      .domain(yLabels)
      .range([margin.top, height - margin.bottom])
      .padding(0.08);

    const colorScale = d3
      .scaleLinear()
      .domain([0, maxValue || 1])
      .range(["rgba(96, 165, 250, 0.14)", "#f97316"]);

    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .call((group: any) => group.select(".domain").remove());

    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((group: any) => group.select(".domain").remove());

    svg
      .append("g")
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (item: HeatmapDatum) => xScale(item.x) ?? margin.left)
      .attr("y", (item: HeatmapDatum) => yScale(item.y) ?? margin.top)
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("rx", 8)
      .attr("fill", (item: HeatmapDatum) => colorScale(item.value));

    svg
      .append("g")
      .selectAll("text")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "d3-value-label")
      .attr("x", (item: HeatmapDatum) => (xScale(item.x) ?? margin.left) + xScale.bandwidth() / 2)
      .attr("y", (item: HeatmapDatum) => (yScale(item.y) ?? margin.top) + yScale.bandwidth() / 2 + 4)
      .attr("text-anchor", "middle")
      .text((item: HeatmapDatum) => item.value.toLocaleString());
  }, [data, height, margin.bottom, margin.left, margin.right, margin.top]);

  return <svg ref={ref} className="d3-chart" role="img" aria-label="Heatmap chart" />;
}
