import { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
};

export function Panel({ title, subtitle, aside, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
