import { RouteStat } from "../data/presentationData";
import { StatusBadge } from "./StatusBadge";

type RouteListProps = {
  routes: RouteStat[];
};

export function RouteList({ routes }: RouteListProps) {
  return (
    <div className="route-list">
      {routes.map((route) => (
        <article key={route.route} className="route-list-item">
          <div>
            <strong>{route.route}</strong>
            <p>{route.totalHits} total hits</p>
          </div>
          <div className="route-list-side">
            <StatusBadge label={`${route.suspiciousHits} flagged`} tone={route.tone} />
          </div>
        </article>
      ))}
    </div>
  );
}
