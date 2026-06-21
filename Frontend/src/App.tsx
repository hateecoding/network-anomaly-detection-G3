import { useEffect, useState } from "react";
import { DashboardPage } from "./components/DashboardPage";
import { Layout, type PageId } from "./components/Layout";
import { LiveVisitorsPage } from "./components/LiveVisitorsPage";
import { SelfTestPage } from "./components/SelfTestPage";
import { UploadLogsPage } from "./components/UploadLogsPage";
import { trackFrontendVisit } from "./utils/liveVisitors";

const validPages: PageId[] = ["dashboard", "upload", "visitors", "self-test"];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>(() => getPageFromHash());
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState(new Date());

  useEffect(() => {
    const handleHashChange = () => {
      setActivePage(getPageFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    void trackFrontendVisit(getTrackedRoute(activePage)).catch(() => undefined);
  }, [activePage]);

  const handleRefresh = () => {
    setRefreshNonce((value) => value + 1);
    setLastRefreshAt(new Date());
  };

  const handleNavigate = (page: PageId) => {
    window.location.hash = page;
    setActivePage(page);
  };

  return (
    <Layout
      activePage={activePage}
      lastRefreshAt={lastRefreshAt}
      onNavigate={handleNavigate}
      onRefresh={handleRefresh}
    >
      {activePage === "dashboard" ? <DashboardPage /> : null}
      {activePage === "upload" ? <UploadLogsPage /> : null}
      {activePage === "visitors" ? <LiveVisitorsPage refreshNonce={refreshNonce} /> : null}
      {activePage === "self-test" ? <SelfTestPage /> : null}
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
