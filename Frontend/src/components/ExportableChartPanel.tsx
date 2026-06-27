import type { ReactNode } from "react";
import { exportChartCardAsPng } from "../utils/d3ChartUtils";
import { Panel } from "./Panel";

type ExportableChartPanelProps = {
  title: string;
  subtitle?: string;
  filename: string;
  children: ReactNode;
};

export function ExportableChartPanel({
  title,
  subtitle,
  filename,
  children,
}: ExportableChartPanelProps) {
  return (
    <div className="chart-export-wrap" data-chart-export-card>
      <Panel
        title={title}
        subtitle={subtitle}
        aside={(
          <button
            type="button"
            className="chart-action-button"
            data-export-hidden="true"
            onClick={(event) => exportChartCardAsPng(event.currentTarget, filename)}
          >
            Export PNG
          </button>
        )}
      >
        {children}
      </Panel>
    </div>
  );
}
