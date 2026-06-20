import { useEffect, useRef } from "react";

type BarDatum = {
  label: string;
  value: number;
  color?: string;
  suffix?: string;
};

type BarChartProps = {
  data: BarDatum[];
  height?: number;
};

export function BarChart({ data, height = 280 }: BarChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const width = 560;
  const margin = { top: 16, right: 38, bottom: 18, left: 136 };

  useEffect(() => {
    if (!ref.current || data.length === 0) {
      return;
    }

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const maxValue = d3.max(data, (item: BarDatum) => item.value) ?? 1;
    const xScale = d3
      .scaleLinear()
      .domain([0, maxValue * 1.1 || 1])
      .nice()
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleBand()
      .domain(data.map((item) => item.label))
      .range([margin.top, height - margin.bottom])
      .padding(0.22);

    const axisTop = d3.axisTop(xScale).ticks(4).tickSize(0);
    const axisLeft = d3.axisLeft(yScale).tickSize(0);

    xScale.ticks(4).forEach((tick: number) => {
      svg
        .append("line")
        .attr("class", "d3-grid-line")
        .attr("x1", xScale(tick))
        .attr("x2", xScale(tick))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom);
    });

    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(0,${margin.top})`)
      .call(axisTop)
      .call((group: any) => group.select(".domain").remove());

    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(axisLeft)
      .call((group: any) => group.select(".domain").remove());

    svg
      .append("g")
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", margin.left)
      .attr("y", (item: BarDatum) => yScale(item.label) ?? margin.top)
      .attr("height", yScale.bandwidth())
      .attr("width", (item: BarDatum) => xScale(item.value) - margin.left)
      .attr("rx", 8)
      .attr("fill", (item: BarDatum) => item.color ?? "#5eead4");

    svg
      .append("g")
      .selectAll("text")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "d3-value-label")
      .attr("x", (item: BarDatum) => xScale(item.value) + 8)
      .attr("y", (item: BarDatum) => (yScale(item.label) ?? margin.top) + yScale.bandwidth() / 2 + 4)
      .text((item: BarDatum) => `${item.value}${item.suffix ?? ""}`);
  }, [data, height, margin.bottom, margin.left, margin.right, margin.top, width]);

  return <svg ref={ref} className="d3-chart" role="img" aria-label="Feature importance chart" />;
}
