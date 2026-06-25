import * as d3 from "d3";

const TOOLTIP_CLASS = "d3-tooltip";

export function showChartTooltip(
  event: MouseEvent | PointerEvent,
  title: string,
  lines: string[],
) {
  const tooltip = getTooltip();
  tooltip.replaceChildren();

  const heading = document.createElement("strong");
  heading.textContent = title;
  tooltip.appendChild(heading);

  lines.forEach((line) => {
    const item = document.createElement("span");
    item.textContent = line;
    tooltip.appendChild(item);
  });

  tooltip.classList.add("d3-tooltip-visible");
  moveChartTooltip(event);
}

export function moveChartTooltip(event: MouseEvent | PointerEvent) {
  const tooltip = getTooltip();
  const offset = 16;
  const maxLeft = window.innerWidth - tooltip.offsetWidth - 12;
  const maxTop = window.innerHeight - tooltip.offsetHeight - 12;
  tooltip.style.left = `${Math.max(12, Math.min(event.clientX + offset, maxLeft))}px`;
  tooltip.style.top = `${Math.max(12, Math.min(event.clientY + offset, maxTop))}px`;
}

export function hideChartTooltip() {
  document.querySelector<HTMLElement>(`.${TOOLTIP_CLASS}`)?.classList.remove(
    "d3-tooltip-visible",
  );
}

export function exportSvgAsPng(svg: SVGSVGElement | null, filename: string) {
  if (!svg) {
    return;
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || svg.clientWidth || 900;
  const height = viewBox.height || svg.clientHeight || 500;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  image.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(url);
      return;
    }

    context.scale(scale, scale);
    context.fillStyle = "#0d1726";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((png) => {
      if (!png) {
        URL.revokeObjectURL(url);
        return;
      }
      const downloadUrl = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  image.src = url;
}

export function animatePathDraw(
  selection: d3.Selection<SVGPathElement, unknown, null, undefined>,
  duration = 650,
) {
  selection.each(function animate() {
    const length = this.getTotalLength();
    d3.select(this)
      .attr("stroke-dasharray", `${length} ${length}`)
      .attr("stroke-dashoffset", length)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);
  });
}

function getTooltip() {
  let tooltip = document.querySelector<HTMLElement>(`.${TOOLTIP_CLASS}`);
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = TOOLTIP_CLASS;
    document.body.appendChild(tooltip);
  }
  return tooltip;
}
