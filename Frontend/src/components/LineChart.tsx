import { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  animatePathDraw,
  exportChartCardAsPng,
  hideChartTooltip,
  moveChartTooltip,
  showChartTooltip,
} from "../utils/d3ChartUtils";

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

export function LineChart({ series, height = 320 }: LineChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGGElement, unknown> | null>(null);
  const zoomTargetRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!ref.current || series.length === 0) return;

    const width = 760;
    const margin = { top: 20, right: 24, bottom: 72, left: 58 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const labels = series[0]?.values.map((item) => item.label) ?? [];
    if (labels.length === 0) return;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const maximumIndex = Math.max(1, labels.length - 1);
    const maximumValue =
      d3.max(series.flatMap((item) => item.values.map((point) => point.value))) ?? 1;
    const baseX = d3.scaleLinear().domain([0, maximumIndex]).range([0, plotWidth]);
    const y = d3
      .scaleLinear()
      .domain([0, maximumValue * 1.15 || 1])
      .nice()
      .range([plotHeight, 0]);

    const clipId = `dashboard-trend-clip-${Math.random().toString(36).slice(2)}`;
    svg.append("defs").append("clipPath").attr("id", clipId)
      .append("rect")
      .attr("width", plotWidth)
      .attr("height", plotHeight);

    const frame = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    zoomTargetRef.current = frame.node();
    frame.append("rect")
      .attr("width", plotWidth)
      .attr("height", plotHeight)
      .attr("fill", "transparent")
      .style("cursor", "grab");

    const grid = frame.append("g");
    y.ticks(5).forEach((tick) => {
      grid.append("line")
        .attr("class", "d3-grid-line")
        .attr("x1", 0)
        .attr("x2", plotWidth)
        .attr("y1", y(tick))
        .attr("y2", y(tick));
    });

    const plot = frame.append("g").attr("clip-path", `url(#${clipId})`);
    const xAxis = frame.append("g")
      .attr("class", "d3-axis dashboard-trend-x-axis")
      .attr("transform", `translate(0,${plotHeight})`);
    frame.append("g")
      .attr("class", "d3-axis")
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(10))
      .call((group) => group.select(".domain").remove());

    const pathBySeries = new Map<string, d3.Selection<SVGPathElement, DataPoint[], null, undefined>>();
    const pointsBySeries = new Map<string, d3.Selection<SVGCircleElement, DataPoint, SVGGElement, unknown>>();

    const buildLine = (scale: d3.ScaleLinear<number, number>) => d3
      .line<DataPoint>()
      .x((_point, index) => scale(index))
      .y((point) => y(point.value))
      .curve(d3.curveMonotoneX);

    series.forEach((item) => {
      const path = plot.append("path")
        .datum(item.values)
        .attr("class", "d3-line-path")
        .attr("fill", "none")
        .attr("stroke", item.color)
        .attr("stroke-width", 2.5)
        .attr("d", buildLine(baseX));
      animatePathDraw(path as d3.Selection<SVGPathElement, unknown, null, undefined>, 650);
      pathBySeries.set(item.key, path);

      const points = plot.append("g")
        .selectAll<SVGCircleElement, DataPoint>("circle")
        .data(item.values)
        .enter()
        .append("circle")
        .attr("cx", (_point, index) => baseX(index))
        .attr("cy", y(0))
        .attr("r", 0)
        .attr("fill", item.color)
        .attr("stroke", "#0d1726")
        .attr("stroke-width", 2)
        .style("cursor", "crosshair")
        .on("pointerenter", function (event: PointerEvent, point) {
          d3.select(this).interrupt().transition().duration(160).attr("r", 6.5).attr("stroke", "#ffffff");
          showChartTooltip(event, point.label, [
            `${item.label}: ${point.value.toLocaleString()}`,
          ]);
        })
        .on("pointermove", (event: PointerEvent) => moveChartTooltip(event))
        .on("pointerleave", function () {
          hideChartTooltip();
          d3.select(this).interrupt().transition().duration(160).attr("r", 4).attr("stroke", "#0d1726");
        });
      points.transition()
        .duration(560)
        .delay((_point, index) => Math.min(index * 24, 280))
        .ease(d3.easeCubicOut)
        .attr("cy", (point) => y(point.value))
        .attr("r", 4);
      pointsBySeries.set(item.key, points);
    });

    const updateXAxis = (scale: d3.ScaleLinear<number, number>) => {
      const tickValues = getReadableTickIndices(scale.domain(), labels.length, 6);
      xAxis.call(
        d3.axisBottom(scale)
          .tickValues(tickValues)
          .tickSize(0)
          .tickPadding(12)
          .tickFormat((value) => labels[Math.round(Number(value))] ?? ""),
      );
      xAxis.select(".domain").remove();
      xAxis.selectAll("text")
        .attr("transform", "rotate(-32)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.45em")
        .attr("dy", "0.3em");
    };
    updateXAxis(baseX);

    const zoom = d3.zoom<SVGGElement, unknown>()
      .scaleExtent([1, 24])
      .translateExtent([[0, 0], [plotWidth, plotHeight]])
      .extent([[0, 0], [plotWidth, plotHeight]])
      .on("start", () => frame.select("rect").style("cursor", "grabbing"))
      .on("zoom", (event) => {
        const transformedX = event.transform.rescaleX(baseX);
        updateXAxis(transformedX);
        series.forEach((item) => {
          pathBySeries.get(item.key)?.attr("d", buildLine(transformedX));
          pointsBySeries.get(item.key)?.attr("cx", (_point, index) => transformedX(index));
        });
      })
      .on("end", () => frame.select("rect").style("cursor", "grab"));
    zoomRef.current = zoom;
    frame.call(zoom);

    return () => {
      zoomTargetRef.current = null;
      hideChartTooltip();
    };
  }, [height, series]);

  return (
    <div className="chart-shell dashboard-trend-chart">
      <div className="chart-action-row">
        <div className="chart-legend">
          {series.map((item) => (
            <span key={item.key} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        <div className="chart-action-buttons">
          <button
            type="button"
            className="chart-action-button"
            data-export-hidden="true"
            onClick={() => {
              if (zoomTargetRef.current && zoomRef.current) {
                d3.select(zoomTargetRef.current).transition().duration(350).call(
                  zoomRef.current.transform,
                  d3.zoomIdentity,
                );
              }
            }}
          >
            Reset zoom
          </button>
          <button
            type="button"
            className="chart-action-button"
            data-export-hidden="true"
            onClick={(event) => exportChartCardAsPng(event.currentTarget, "recent-detections.png")}
          >
            Export PNG
          </button>
        </div>
      </div>
      <svg ref={ref} className="d3-chart" role="img" aria-label="Recent detections trend chart" />
    </div>
  );
}

function getReadableTickIndices(
  domain: number[],
  labelCount: number,
  maximumTicks: number,
) {
  const start = Math.max(0, Math.ceil(Math.min(...domain)));
  const end = Math.min(labelCount - 1, Math.floor(Math.max(...domain)));
  if (end < start) return [0];

  const visible = d3.range(start, end + 1);
  if (visible.length <= maximumTicks) return visible;

  const stride = Math.ceil((visible.length - 1) / (maximumTicks - 1));
  const reduced = visible.filter((_value, index) => index % stride === 0);
  if (reduced[reduced.length - 1] !== end) reduced.push(end);
  return reduced;
}
