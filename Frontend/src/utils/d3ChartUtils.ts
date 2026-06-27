import * as d3 from "d3";

const TOOLTIP_CLASS = "d3-tooltip";

export function showChartTooltip(
  event: MouseEvent | PointerEvent,
  title: string,
  lines: string[],
) {
  // A single shared tooltip avoids each chart owning duplicate floating DOM.
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

export function exportChartCardAsPng(
  trigger: HTMLElement | null,
  filename: string,
) {
  const card =
    trigger?.closest<HTMLElement>("[data-chart-export-card]") ??
    trigger?.closest<HTMLElement>(".panel");

  if (!card) {
    return;
  }

  void exportElementAsPng(card, filename).catch((error) => {
    console.error("Chart PNG export failed.", error);
  });
}

export async function exportElementAsPng(element: HTMLElement, filename: string) {
  const { default: html2canvas } = await import("html2canvas");
  await document.fonts.ready;
  await nextPaint();

  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, element.scrollWidth, 320));
  const height = Math.ceil(Math.max(rect.height, element.scrollHeight, 240));
  const canvas = await html2canvas(element, {
    backgroundColor: "#0d1726",
    height,
    width,
    scale: Math.min(2, Math.max(1, window.devicePixelRatio)),
    useCORS: true,
    logging: false,
    imageTimeout: 10_000,
    removeContainer: true,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowHeight: Math.max(document.documentElement.clientHeight, height),
    windowWidth: Math.max(document.documentElement.clientWidth, width),
    ignoreElements: (candidate) =>
      candidate instanceof HTMLElement && candidate.dataset.exportHidden === "true",
    onclone: (_document, clone) => {
      clone.style.width = `${width}px`;
      clone.style.height = `${height}px`;
      clone.style.maxWidth = "none";
      clone.style.overflow = "visible";
      clone.style.margin = "0";
      clone.style.background = "#0d1726";
      clone.style.boxShadow = "none";
      clone.querySelectorAll<HTMLElement>("*").forEach((item) => {
        item.style.animation = "none";
        item.style.transition = "none";
      });
      clone.querySelectorAll<HTMLElement>(".panel, .chart-shell, .chart-insight-layout, .chart-insight-visual").forEach((item) => {
        item.style.overflow = "visible";
      });
    },
  });

  const png = await canvasToBlob(canvas);
  const downloadUrl = URL.createObjectURL(png);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

export function animatePathDraw(
  selection: d3.Selection<SVGPathElement, unknown, null, undefined>,
  duration = 650,
) {
  // Line charts use stroke-dash animation to make refreshed data feel intentional without changing values.
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

function nextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The chart image could not be generated."));
    }, "image/png");
  });
}
