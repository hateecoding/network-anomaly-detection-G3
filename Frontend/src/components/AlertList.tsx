import { AlertRecord } from "../data/mockData";
import { StatusBadge } from "./StatusBadge";

type AlertListProps = {
  alerts: AlertRecord[];
};

export function AlertList({ alerts }: AlertListProps) {
  return (
    <div className="alert-list">
      {alerts.map((alert) => (
        <article key={alert.id} className="alert-item">
          <div className="alert-item-header">
            <div>
              <p className="eyebrow">{alert.id}</p>
              <h4>{alert.title}</h4>
            </div>
            <StatusBadge label={alert.severity} tone={alert.severity} />
          </div>
          <p>{alert.detail}</p>
          <div className="alert-item-meta">
            <span>{alert.source}</span>
            <span>{alert.route}</span>
            <span>{alert.timestamp}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
