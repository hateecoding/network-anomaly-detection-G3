import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ProtocolRiskPoint } from "../utils/uploadAnalysis";
import {
  exportChartCardAsPng,
  hideChartTooltip,
  moveChartTooltip,
  showChartTooltip,
} from "../utils/d3ChartUtils";

type DisplayCategory = "Normal" | "Review Recommended" | "Attack";
type SortOption = "total" | "attack" | "rate";

type D3ProtocolRiskChartProps = {
  data: ProtocolRiskPoint[];
  selectedProtocol?: string | null;
  onSelect: (protocol: string, category?: DisplayCategory) => void;
};

const categories = [
  { key: "normal", label: "Normal", color: "#34d399" },
  { key: "reviewRecommended", label: "Review Recommended", color: "#fbbf24" },
  { key: "attack", label: "Attack", color: "#ef4444" },
] as const;

export function D3ProtocolRiskChart({
  data,
  selectedProtocol = null,
  onSelect,
}: D3ProtocolRiskChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("rate");

  useEffect(() => {
    if (!ref.current || data.length === 0) {
      return;
    }

    const sortedData = [...data].sort((left, right) => {
      if (sortBy === "attack") return right.attack - left.attack;
      if (sortBy === "total") return right.totalRecords - left.totalRecords;
      return right.attackRate - left.attackRate;
    });
    const width = 700;
    const height = 330;
    const margin = { top: 28, right: 28, bottom: 58, left: 58 };
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3
      .scaleBand()
      .domain(sortedData.map((item) => item.protocol))
      .range([margin.left, width - margin.right])
      .padding(0.28);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(sortedData, (item) => item.totalRecords) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top]);
    const stack = d3
      .stack<ProtocolRiskPoint>()
      .keys(categories.map((category) => category.key));

    svg
      .append("g")
      .selectAll("g")
      .data(stack(sortedData))
      .enter()
      .append("g")
      .attr("fill", (series) => categories.find((item) => item.key === series.key)?.color ?? "#60a5fa")
      .selectAll("rect")
      .data((series) => series.map((segment) => ({ segment, key: series.key })))
      .enter()
      .append("rect")
      .attr("x", ({ segment }) => x(segment.data.protocol) ?? margin.left)
      .attr("y", y(0))
      .attr("height", 0)
      .attr("width", x.bandwidth())
      .attr("rx", 4)
      .attr("opacity", ({ segment }) =>
        selectedProtocol && selectedProtocol !== segment.data.protocol ? 0.28 : 1
      )
      .style("cursor", "pointer")
      .on("pointerenter", (event: PointerEvent, { segment, key }) => {
        const category = categories.find((item) => item.key === key);
        const count = segment[1] - segment[0];
        const percentage = segment.data.totalRecords > 0
          ? (count / segment.data.totalRecords) * 100
          : 0;
        showChartTooltip(event, `${segment.data.protocol} · ${category?.label}`, [
          `${count.toLocaleString()} records`,
          `${percentage.toFixed(1)}% of protocol traffic`,
          `Attack rate: ${(segment.data.attackRate * 100).toFixed(1)}%`,
          "Click to filter protocol and category",
        ]);
      })
      .on("pointermove", (event: PointerEvent) => moveChartTooltip(event))
      .on("pointerleave", hideChartTooltip)
      .on("click", (_event, { segment, key }) => {
        const category = categories.find((item) => item.key === key);
        onSelect(segment.data.protocol, category?.label);
      })
      .transition()
      .duration(620)
      .ease(d3.easeCubicOut)
      .attr("y", ({ segment }) => y(segment[1]))
      .attr("height", ({ segment }) => y(segment[0]) - y(segment[1]));

    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((group) => group.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((group) => group.select(".domain").remove());

    svg
      .append("text")
      .attr("class", "d3-value-label")
      .attr("x", 16)
      .attr("y", margin.top - 10)
      .text("Records");

    svg
      .append("g")
      .selectAll("text")
      .data(sortedData)
      .enter()
      .append("text")
      .attr("class", "d3-value-label")
      .attr("x", (item) => (x(item.protocol) ?? margin.left) + x.bandwidth() / 2)
      .attr("y", (item) => y(item.totalRecords) - 8)
      .attr("text-anchor", "middle")
      .text((item) => `${(item.attackRate * 100).toFixed(1)}% risk`);
  }, [data, onSelect, selectedProtocol, sortBy]);

  return (
    <div className="chart-shell">
      <div className="chart-action-row">
        <div className="chart-legend">
          {categories.map((category) => (
            <span key={category.key} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ backgroundColor: category.color }} />
              {category.label}
            </span>
          ))}
        </div>
        <div className="chart-action-buttons">
          <label className="chart-sort-label">
            Sort
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
              <option value="rate">Attack rate</option>
              <option value="attack">Attack count</option>
              <option value="total">Total records</option>
            </select>
          </label>
          <button
            type="button"
            className="chart-action-button"
            data-export-hidden="true"
            onClick={(event) => exportChartCardAsPng(event.currentTarget, "protocol-risk.png")}
          >
            Export PNG
          </button>
        </div>
      </div>
      <svg ref={ref} className="d3-chart" role="img" aria-label="Protocol risk comparison" />
    </div>
  );
}
