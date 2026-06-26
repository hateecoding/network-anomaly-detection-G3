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

  exportElementAsPng(card, filename);
}

export function exportElementAsPng(element: HTMLElement, filename: string) {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, element.scrollWidth, 320));
  const height = Math.ceil(Math.max(rect.height, element.scrollHeight, 240));
  const clone = element.cloneNode(true) as HTMLElement;

  clone.querySelectorAll("[data-export-hidden='true']").forEach((item) => item.remove());
  inlineComputedStyles(element, clone);

  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = "0";
  clone.style.background = "#0d1726";
  clone.style.boxShadow = "none";

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.background = "#0d1726";
  wrapper.appendChild(clone);

  const source = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        ${new XMLSerializer().serializeToString(wrapper)}
      </foreignObject>
    </svg>
  `;
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

  image.onerror = () => URL.revokeObjectURL(url);
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

function inlineComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const targetElement = target as HTMLElement | SVGElement;

  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    targetElement.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }

  Array.from(source.children).forEach((sourceChild, index) => {
    const targetChild = target.children.item(index);
    if (targetChild) {
      inlineComputedStyles(sourceChild, targetChild);
    }
  });
}
