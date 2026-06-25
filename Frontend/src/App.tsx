import { useCallback, useEffect, useState } from "react";
import { DashboardPage } from "./components/DashboardPage";
import { Layout, type PageId } from "./components/Layout";
import { LiveVisitorsPage } from "./components/LiveVisitorsPage";
import { ModelInsightsPage } from "./components/ModelInsightsPage";
import { SelfTestPage } from "./components/SelfTestPage";
import { UploadLogsPage } from "./components/UploadLogsPage";
import { trackFrontendVisit } from "./utils/liveVisitors";
import type { SyncStatus } from "./utils/sync";

const validPages: PageId[] = ["dashboard", "upload", "visitors", "model-insights", "self-test"];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>(() => getPageFromHash());
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");

  useEffect(() => {
    const handleHashChange = () => {
      setActivePage(getPageFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    void trackFrontendVisit(getTrackedRoute(activePage)).catch(() => undefined);
    setSyncStatus("syncing");
  }, [activePage]);

  const handleRefresh = () => {
    setSyncStatus("syncing");
    setRefreshNonce((value) => value + 1);
  };

  const handleSyncSuccess = useCallback((syncedAt = new Date()) => {
    setLastSyncAt(syncedAt);
    setSyncStatus("success");
  }, []);

  const handleSyncFailure = useCallback(() => {
    setSyncStatus("error");
  }, []);

  const handleNavigate = (page: PageId) => {
    window.location.hash = page;
    setActivePage(page);
  };

  return (
    <Layout
      activePage={activePage}
      lastSyncAt={lastSyncAt}
      syncStatus={syncStatus}
      onNavigate={handleNavigate}
      onRefresh={handleRefresh}
    >
      {activePage === "dashboard" ? (
        <DashboardPage
          refreshNonce={refreshNonce}
          onSyncSuccess={handleSyncSuccess}
          onSyncFailure={handleSyncFailure}
        />
      ) : null}
      {activePage === "upload" ? (
        <UploadLogsPage
          refreshNonce={refreshNonce}
          onRequestRefresh={handleRefresh}
          onSyncSuccess={handleSyncSuccess}
          onSyncFailure={handleSyncFailure}
        />
      ) : null}
      {activePage === "visitors" ? (
        <LiveVisitorsPage
          refreshNonce={refreshNonce}
          onSyncSuccess={handleSyncSuccess}
          onSyncFailure={handleSyncFailure}
        />
      ) : null}
      {activePage === "model-insights" ? (
        <ModelInsightsPage
          refreshNonce={refreshNonce}
          onSyncSuccess={handleSyncSuccess}
          onSyncFailure={handleSyncFailure}
        />
      ) : null}
      {activePage === "self-test" ? (
        <SelfTestPage
          refreshNonce={refreshNonce}
          onSyncSuccess={handleSyncSuccess}
          onSyncFailure={handleSyncFailure}
        />
      ) : null}
    </Layout>
  );
}

function getTrackedRoute(page: PageId) {
  return page === "dashboard" ? "/dashboard" : `/${page}`;
}

function getPageFromHash(): PageId {
  const hash = window.location.hash.replace("#", "");
  return validPages.includes(hash as PageId) ? (hash as PageId) : "dashboard";
}
