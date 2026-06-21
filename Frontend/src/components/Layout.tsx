import { ReactNode, useEffect, useState } from "react";
import { Tone } from "../data/presentationData";
import { StatusBadge } from "./StatusBadge";

export type PageId =
  | "dashboard"
  | "upload"
  | "visitors"
  | "model-insights"
  | "self-test";

type NavItem = {
  id: PageId;
  label: string;
  caption: string;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", caption: "System summary" },
  { id: "upload", label: "Upload Logs", caption: "Batch analysis" },
  { id: "visitors", label: "Live Visitors", caption: "Website activity" },
  { id: "model-insights", label: "Model Insights", caption: "Model metrics" },
  { id: "self-test", label: "Self-Test", caption: "Manual prediction" },
];

const pageHeadings: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Overall summary of uploaded detections, alerts, visitors, and the latest self-test result.",
  },
  upload: {
    title: "Upload Logs",
    subtitle: "Upload CSV logs, review analyzed rows, and focus quickly on suspicious entries.",
  },
  visitors: {
    title: "Live Visitors",
    subtitle: "Track website visitors, suspicious request bursts, route pressure, and recent activity.",
  },
  "model-insights": {
    title: "Model Insights",
    subtitle: "Review deployed model metadata, recommended model selection, and backend performance metrics.",
  },
  "self-test": {
    title: "Self-Test",
    subtitle: "Manually enter traffic features and inspect the AI prediction response.",
  },
};

type LayoutProps = {
  activePage: PageId;
  lastRefreshAt: Date;
  onNavigate: (page: PageId) => void;
  onRefresh: () => void;
  children: ReactNode;
};

export function Layout({
  activePage,
  lastRefreshAt,
  onNavigate,
  onRefresh,
  children,
}: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const heading = pageHeadings[activePage];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <div>
            <p className="eyebrow">Anomaly Network</p>
            <h1>Network Monitor</h1>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${item.id === activePage ? "nav-item-active" : ""}`}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
            >
              <span>{item.label}</span>
              <small>{item.caption}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="eyebrow">Deployment Status</p>
          <StatusBadge label="Live AI Service" tone={"info" satisfies Tone} />
          <p>Connected to FastAPI endpoints for upload analysis, dashboard summary, visitors, and prediction.</p>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          className="sidebar-overlay"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <main className="main-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Security Operations</p>
            <h2>{heading.title}</h2>
            <p className="topbar-subtitle">{heading.subtitle}</p>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMobileOpen((value) => !value)}
            >
              Menu
            </button>
            <button type="button" className="refresh-button" onClick={onRefresh}>
              Refresh
            </button>
            <StatusBadge label="Production" tone="info" />
            <div className="signal-card">
              <span className="signal-dot" />
              Last sync {formatTimestamp(lastRefreshAt)}
            </div>
            <div className="clock-card">{formatTimestamp(now)}</div>
          </div>
        </header>

        <section className="page-content">{children}</section>
      </main>
    </div>
  );
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
