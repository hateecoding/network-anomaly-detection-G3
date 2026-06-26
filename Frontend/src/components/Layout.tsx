import { ReactNode, useEffect, useState } from "react";
import { Tone } from "../data/presentationData";
import type { SyncStatus } from "../utils/sync";
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
    subtitle: "Batch network traffic analysis with AI prediction and dataset insights.",
  },
  visitors: {
    title: "Live Visitors",
    subtitle: "Track backend request activity, page-view pings, route pressure, and recent activity.",
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
  lastSyncAt: Date | null;
  syncStatus: SyncStatus;
  onNavigate: (page: PageId) => void;
  onRefresh: () => void;
  children: ReactNode;
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = "aegis-net.sidebar-collapsed";

export function Layout({
  activePage,
  lastSyncAt,
  syncStatus,
  onNavigate,
  onRefresh,
  children,
}: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    loadSidebarCollapsedPreference(activePage),
  );
  const [now, setNow] = useState(new Date());

  // Keeps the clock and sync labels feeling live without coupling them to page polling.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const heading = pageHeadings[activePage];
  const toggleSidebar = () => {
    // Persisting the rail state gives Upload Logs more horizontal space after refresh/navigation.
    setSidebarCollapsed((current) => {
      const next = !current;
      saveSidebarCollapsedPreference(next);
      return next;
    });
  };

  return (
    <div className={`app-shell app-shell-${activePage} ${sidebarCollapsed ? "app-shell-sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-collapse-button"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>

        <div className="sidebar-brand">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <div className="sidebar-brand-copy">
            <p className="eyebrow">Anomaly Network</p>
            <h1 className="sidebar-brand-title">Network Monitor</h1>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${item.id === activePage ? "nav-item-active" : ""}`}
              title={sidebarCollapsed ? `${item.label} - ${item.caption}` : undefined}
              aria-label={sidebarCollapsed ? item.label : undefined}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
            >
              <span className="nav-item-icon" aria-hidden="true">
                <NavIcon page={item.id} />
              </span>
              <span className="nav-item-copy">
                <span>{item.label}</span>
                <small>{item.caption}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-status-dot" aria-hidden="true" />
          <div className="sidebar-footer-copy">
            <p className="eyebrow">Deployment Status</p>
            <StatusBadge label="Live AI Service" tone={"info" satisfies Tone} />
            <p>Connected to FastAPI endpoints for upload analysis, dashboard summary, visitors, and prediction.</p>
          </div>
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

      <main className={`main-shell main-shell-${activePage}`}>
        <header className={`topbar topbar-${activePage}`}>
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
            <div
              className={`signal-card signal-card-${syncStatus}`}
              title={
                lastSyncAt
                  ? `Last successful sync: ${formatExactTimestamp(lastSyncAt)}`
                  : "Waiting for the first successful backend sync."
              }
            >
              <span className="signal-dot" />
              <span className="signal-copy">
                <span>
                  {syncStatus === "error"
                    ? "Sync failed, retrying..."
                    : syncStatus === "syncing"
                      ? "Syncing..."
                      : `Last sync ${formatExactTimestamp(lastSyncAt)}`}
                </span>
                {syncStatus !== "success" && lastSyncAt ? (
                  <small>Last sync {formatExactTimestamp(lastSyncAt)}</small>
                ) : null}
              </span>
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

function NavIcon({ page }: { page: PageId }) {
  const commonProps = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  if (page === "dashboard") {
    return (
      <svg {...commonProps}>
        <path d="M4 5.5C4 4.67 4.67 4 5.5 4h4C10.33 4 11 4.67 11 5.5v4c0 .83-.67 1.5-1.5 1.5h-4C4.67 11 4 10.33 4 9.5v-4Z" />
        <path d="M13 5.5c0-.83.67-1.5 1.5-1.5h4c.83 0 1.5.67 1.5 1.5v4c0 .83-.67 1.5-1.5 1.5h-4c-.83 0-1.5-.67-1.5-1.5v-4Z" />
        <path d="M4 14.5c0-.83.67-1.5 1.5-1.5h4c.83 0 1.5.67 1.5 1.5v4c0 .83-.67 1.5-1.5 1.5h-4C4.67 20 4 19.33 4 18.5v-4Z" />
        <path d="M13 14.5c0-.83.67-1.5 1.5-1.5h4c.83 0 1.5.67 1.5 1.5v4c0 .83-.67 1.5-1.5 1.5h-4c-.83 0-1.5-.67-1.5-1.5v-4Z" />
      </svg>
    );
  }

  if (page === "upload") {
    return (
      <svg {...commonProps}>
        <path d="M7 18.5H6.2A3.2 3.2 0 0 1 6 12.1a5.4 5.4 0 0 1 10.4-1.7A4.1 4.1 0 0 1 17.7 18.5H17" />
        <path d="M12 19V10" />
        <path d="m8.8 13.2 3.2-3.2 3.2 3.2" />
      </svg>
    );
  }

  if (page === "visitors") {
    return (
      <svg {...commonProps}>
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M3.6 9h16.8" />
        <path d="M3.6 15h16.8" />
        <path d="M12 3c2.25 2.45 3.38 5.45 3.38 9S14.25 18.55 12 21c-2.25-2.45-3.38-5.45-3.38-9S9.75 5.45 12 3Z" />
      </svg>
    );
  }

  if (page === "model-insights") {
    return (
      <svg {...commonProps}>
        <path d="M9 5.8A3 3 0 0 0 4.5 8.4 3.2 3.2 0 0 0 6 14.4 3.1 3.1 0 0 0 9 19V5.8Z" />
        <path d="M15 5.8a3 3 0 0 1 4.5 2.6 3.2 3.2 0 0 1-1.5 6 3.1 3.1 0 0 1-3 4.6V5.8Z" />
        <path d="M9 9.2H6.8" />
        <path d="M15 9.2h2.2" />
        <path d="M9 13h6" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M9 3h6" />
      <path d="M10 3v5.2l-4.6 7.4A3.4 3.4 0 0 0 8.3 21h7.4a3.4 3.4 0 0 0 2.9-5.2L14 8.2V3" />
      <path d="M8.4 15h7.2" />
      <path d="M10.2 18h3.6" />
    </svg>
  );
}

function formatExactTimestamp(date: Date | null) {
  if (!date) {
    return "not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function loadSidebarCollapsedPreference(activePage: PageId) {
  try {
    const savedPreference = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (savedPreference === "true") {
      return true;
    }
    if (savedPreference === "false") {
      return false;
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }

  // Upload Logs is chart-heavy, so a first-time visitor gets the space-saving rail by default.
  return activePage === "upload";
}

function saveSidebarCollapsedPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
