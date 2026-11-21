"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

const NAV_ITEMS = ["Overview", "Activity", "Content Analytics", "Platforms", "Insights", "Settings"] as const;
const PERIODS = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "All Time"] as const;
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

type PlatformStats = {
  posts: number;
  videos: number;
  articles: number;
  images: number;
  organic: number;
  sponsored: number;
  activeSeconds: number;
  breakdown: Record<"text" | "video" | "article" | "image", number>;
};

type DailyStats = {
  totalPosts: number;
  activeSeconds: number;
  platforms: Record<"x" | "linkedin", PlatformStats>;
  updatedAt?: string | null;
};

type Analytics = {
  totalPosts: number;
  activeSeconds: number;
  platforms: Record<"x" | "linkedin", PlatformStats>;
  updatedAt?: string | null;
  daily: Record<string, DailyStats>;
};

type ExtensionResponse = {
  success: boolean;
  stats?: Analytics;
  trackingEnabled?: boolean;
  error?: string;
};

// Thrown only when messaging itself fails: the extension is
// missing, unreachable, timed out, or rejected the channel.
// A response with success:false is an extension-level error,
// not a connection failure.
class ExtensionConnectionError extends Error {}

type Period = (typeof PERIODS)[number];
type PlatformKey = "x" | "linkedin";
type ContentKey = "text" | "video" | "article" | "image";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        lastError?: { message?: string };
        sendMessage: (
          extensionId: string,
          message: { type: string; enabled?: boolean },
          callback: (response?: ExtensionResponse) => void,
        ) => void;
      };
    };
  }
}

function requestExtension(extensionId: string, type: string, enabled?: boolean): Promise<ExtensionResponse> {
  return new Promise((resolve, reject) => {
    const runtime = window.chrome?.runtime;
    if (!runtime?.sendMessage) {
      reject(new ExtensionConnectionError("Open this dashboard in Chrome to connect to the BrainWeb extension."));
      return;
    }

    const timeout = window.setTimeout(
      () => reject(new ExtensionConnectionError("The extension did not respond. Check that BrainWeb is installed and enabled.")),
      5000,
    );

    try {
      const message = type === "SET_TRACKING" ? { type, enabled } : { type };
      runtime.sendMessage(extensionId, message, (response) => {
        window.clearTimeout(timeout);
        const error = runtime.lastError?.message;
        if (error) {
          reject(new ExtensionConnectionError(`Could not reach BrainWeb: ${error}`));
        } else if (!response?.success) {
          reject(new Error(response?.error || "The extension returned an invalid response."));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      window.clearTimeout(timeout);
      reject(error instanceof ExtensionConnectionError
        ? error
        : new ExtensionConnectionError("Could not reach the BrainWeb extension."));
    }
  });
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDate(date: Date, amount: number): Date {
  const shifted = new Date(date);
  shifted.setHours(12, 0, 0, 0);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
}

function formatTime(seconds = 0): string {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

function emptyPlatform(): PlatformStats {
  return {
    posts: 0,
    videos: 0,
    articles: 0,
    images: 0,
    organic: 0,
    sponsored: 0,
    activeSeconds: 0,
    breakdown: { text: 0, video: 0, article: 0, image: 0 },
  };
}

function emptyAnalytics(): Analytics {
  return {
    totalPosts: 0,
    activeSeconds: 0,
    platforms: { x: emptyPlatform(), linkedin: emptyPlatform() },
    updatedAt: null,
    daily: {},
  };
}

function hasRecordedStats(stats: Analytics | null): boolean {
  if (!stats) return false;
  return stats.totalPosts > 0 ||
    stats.activeSeconds > 0 ||
    Object.keys(stats.daily || {}).length > 0;
}

function platformFor(record: DailyStats | undefined, platform: PlatformKey): PlatformStats {
  return record?.platforms?.[platform] ?? emptyPlatform();
}

function keysForPeriod(period: Period, daily: Analytics["daily"], today: Date): string[] {
  if (period === "Today") return [dateKey(today)];
  if (period === "Yesterday") return [dateKey(shiftDate(today, -1))];
  if (period === "Last 7 Days" || period === "Last 30 Days") {
    const count = period === "Last 7 Days" ? 7 : 30;
    return Array.from({ length: count }, (_, index) => dateKey(shiftDate(today, index - count + 1)));
  }
  return Object.keys(daily).sort();
}

function formatPeriodRange(
  period: Period,
  keys: string[],
  daily: Analytics["daily"],
  todayKey: string,
): string {
  const formatDate = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day, 12).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (period === "Today") return `Today · ${formatDate(todayKey)}`;
  if (period === "Yesterday") {
    return `Yesterday · ${keys[0] ? formatDate(keys[0]) : "no recorded date"}`;
  }
  if (period === "Last 7 Days" || period === "Last 30 Days") {
    const start = keys[0];
    const end = keys[keys.length - 1];
    return start && end ? `${period} · ${formatDate(start)} – ${formatDate(end)}` : period;
  }

  const firstRecordedDate = Object.keys(daily).sort()[0];
  return firstRecordedDate
    ? `All Time · ${formatDate(firstRecordedDate)} – ${formatDate(todayKey)}`
    : "All Time · lifetime totals";
}

function sumPeriod(stats: Analytics, keys: string[]) {
  return keys.reduce(
    (total, key) => {
      const day = stats.daily[key];
      total.totalPosts += Number(day?.totalPosts) || 0;
      total.activeSeconds += Number(day?.activeSeconds) || 0;
      (["x", "linkedin"] as const).forEach((platform) => {
        const source = platformFor(day, platform);
        const target = total.platforms[platform];
        target.posts += Number(source.posts) || 0;
        target.videos += Number(source.videos) || 0;
        target.articles += Number(source.articles) || 0;
        target.images += Number(source.images) || 0;
        target.organic += Number(source.organic) || 0;
        target.sponsored += Number(source.sponsored) || 0;
        target.activeSeconds += Number(source.activeSeconds) || 0;
        (["text", "video", "article", "image"] as const).forEach((type) => {
          target.breakdown[type] += Number(source.breakdown?.[type]) || 0;
        });
      });
      return total;
    },
    {
      totalPosts: 0,
      activeSeconds: 0,
      platforms: { x: emptyPlatform(), linkedin: emptyPlatform() },
    },
  );
}

function dateLabel(key: string, includeWeekday = false): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("en-IN", {
    ...(includeWeekday ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
  });
}

function Metric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className={`metric-card${accent ? " metric-accent" : ""}`}>
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function EmptyState({ children = "Your analytics will appear here as you use X or LinkedIn." }: { children?: string }) {
  return <div className="empty-state"><span className="empty-icon">◷</span><p>{children}</p></div>;
}

function PlatformCard({ name, data, color }: { name: string; data: PlatformStats; color: string }) {
  const total = data.posts || 0;
  return (
    <article className="panel platform-panel">
      <div className="panel-title-row">
        <div className="platform-heading"><i className={`platform-dot ${color}`} /><h3>{name}</h3></div>
        <span className="muted">{total.toLocaleString()} posts</span>
      </div>
      <div className="platform-stats">
        <div><span>Active time</span><strong>{formatTime(data.activeSeconds)}</strong></div>
        <div><span>Organic</span><strong>{data.organic.toLocaleString()}</strong></div>
        <div><span>Sponsored</span><strong>{data.sponsored.toLocaleString()}</strong></div>
      </div>
      <div className="progress-track"><span style={{ width: `${total ? (data.organic / total) * 100 : 0}%` }} /></div>
      <p className="small-note">Organic share · {total ? Math.round((data.organic / total) * 100) : 0}%</p>
    </article>
  );
}

function ActivityChart({
  keys,
  daily,
  todayKey,
  allTime = false,
}: {
  keys: string[];
  daily: Analytics["daily"];
  todayKey: string;
  allTime?: boolean;
}) {
  const max = Math.max(1, ...keys.map((key) => daily[key]?.activeSeconds || 0));
  const hasActivity = keys.some((key) => (daily[key]?.activeSeconds || 0) > 0);
  if (!hasActivity) return <EmptyState>No active time was recorded in this period.</EmptyState>;

  return (
    <div className={allTime ? "activity-chart all-time-chart" : "activity-chart"} role="img" aria-label="Active time by day">
      {keys.map((key) => {
        const seconds = daily[key]?.activeSeconds || 0;
        return (
          <div className="chart-column" key={key} title={`${dateLabel(key)}: ${formatTime(seconds)}`}>
            <span className="chart-value">{seconds ? formatTime(seconds) : "—"}</span>
            <div className="chart-bar-track"><span className={todayKey === key ? "chart-bar today-bar" : "chart-bar"} style={{ height: `${seconds ? Math.max(4, (seconds / max) * 100) : 2}%` }} /></div>
            <span className="chart-label">{dateLabel(key, true).split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ContentBreakdown({ platforms }: { platforms: Record<PlatformKey, PlatformStats> }) {
  const content: [ContentKey, string][] = [["text", "Text"], ["video", "Videos"], ["article", "Articles"], ["image", "Images"]];
  const total = (Object.values(platforms) as PlatformStats[]).reduce((sum, platform) => sum + platform.posts, 0);
  return (
    <div className="content-breakdown">
      {content.map(([key, label]) => {
        const count = (Object.values(platforms) as PlatformStats[]).reduce((sum, platform) => sum + platform.breakdown[key], 0);
        return (
          <div className="content-row" key={key}>
            <div className="content-row-label"><span>{label}</span><strong>{count}</strong></div>
            <div className="progress-track"><span style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [extensionId, setExtensionId] = useState("");
  const [stats, setStats] = useState<Analytics | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [activePage, setActivePage] = useState<(typeof NAV_ITEMS)[number]>("Overview");
  const [period, setPeriod] = useState<Period>("Today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (showSpinner = false) => {
    if (!extensionId) return;
    if (showSpinner) setRefreshing(true);
    try {
      const response = await requestExtension(extensionId, "GET_DASHBOARD_STATS");
      // A valid response means the extension is reachable, even
      // when it has no statistics yet. Missing stats become an
      // empty analytics object so the empty state can render.
      setStats(response.stats ?? emptyAnalytics());
      setTrackingEnabled(response.trackingEnabled !== false);
      setConnected(true);
      setError("");
    } catch (caught) {
      // Only genuine messaging failures mark the extension as
      // disconnected. Extension-level errors keep the last
      // known connection state and data.
      if (caught instanceof ExtensionConnectionError) {
        setConnected(false);
      }
      setError(caught instanceof Error ? caught.message : "Could not connect to BrainWeb.");
    } finally {
      setNow(new Date());
      setLoading(false);
      setRefreshing(false);
    }
  }, [extensionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ids = new URLSearchParams(window.location.search).getAll("extensionId");
      const candidate = ids.length === 1 ? ids[0] : "";
      if (!EXTENSION_ID_PATTERN.test(candidate)) {
        // Not a messaging failure: the disconnected state below
        // already explains how to connect via the extension popup.
        setLoading(false);
        return;
      }
      setExtensionId(candidate);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!extensionId) return;
    const initialRequest = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.clearTimeout(initialRequest);
      window.clearInterval(interval);
    };
  }, [extensionId, refresh]);

  const todayKey = now ? dateKey(now) : "";
  const today = stats?.daily?.[todayKey];
  const periodKeys = useMemo(() => stats && now ? keysForPeriod(period, stats.daily || {}, now) : [], [now, period, stats]);
  const periodRange = useMemo(
    () => stats && todayKey
      ? formatPeriodRange(period, periodKeys, stats.daily || {}, todayKey)
      : period,
    [period, periodKeys, stats, todayKey],
  );
  const periodStats = useMemo(
    () => stats ? (period === "All Time"
      ? { ...stats, platforms: stats.platforms }
      : sumPeriod(stats, periodKeys)) : null,
    [period, periodKeys, stats],
  );
  const chartKeys = useMemo(() => stats ? periodKeys : [], [periodKeys, stats]);

  const toggleTracking = async () => {
    try {
      const response = await requestExtension(extensionId, "SET_TRACKING", !trackingEnabled);
      setTrackingEnabled(response.trackingEnabled !== false);
      if (response.stats) setStats(response.stats);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update tracking.");
    }
  };

  const clearAnalytics = async () => {
    if (!window.confirm("Clear all locally stored BrainWeb analytics? This cannot be undone.")) return;
    try {
      const response = await requestExtension(extensionId, "CLEAR_ANALYTICS");
      if (response.stats) setStats(response.stats);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not clear analytics.");
    }
  };

  const exportJson = () => {
    if (stats) downloadFile(JSON.stringify(stats, null, 2), "brainweb-analytics.json", "application/json");
  };

  const exportCsv = () => {
    if (!stats) return;
    const rows = [["date", "total_posts", "active_seconds", "x_posts", "x_active_seconds", "linkedin_posts", "linkedin_active_seconds"]];
    Object.entries(stats.daily || {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, day]) => {
      rows.push([
        key,
        String(day.totalPosts || 0),
        String(day.activeSeconds || 0),
        String(day.platforms?.x?.posts || 0),
        String(day.platforms?.x?.activeSeconds || 0),
        String(day.platforms?.linkedin?.posts || 0),
        String(day.platforms?.linkedin?.activeSeconds || 0),
      ]);
    });
    downloadFile(rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "brainweb-analytics.csv", "text/csv");
  };

  const pageDescription: Record<(typeof NAV_ITEMS)[number], string> = {
    Overview: "A clear picture of your content consumption.",
    Activity: "Explore how your focused time changes over time.",
    "Content Analytics": "See what kinds of content you consume.",
    Platforms: "Compare activity across your connected platforms.",
    Insights: "Patterns based only on your locally stored analytics.",
    Settings: "Manage tracking, privacy, and your analytics data.",
  };

  const selectedStats = periodStats;
  const selectedPlatforms = selectedStats?.platforms ?? { x: emptyPlatform(), linkedin: emptyPlatform() };
  const hasSelectedData = Boolean(selectedStats && (selectedStats.totalPosts > 0 || selectedStats.activeSeconds > 0));

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActivePage("Overview"); }}>
          <span className="brand-mark">B</span><span>BrainWeb<span className="brand-period">.</span></span>
        </a>
        <p className="brand-caption">Understand your attention. Take control of your digital habits.</p>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item, index) => (
            <button key={item} className={activePage === item ? "nav-item active" : "nav-item"} onClick={() => setActivePage(item)}>
              <span className="nav-icon">{["◫", "◷", "▤", "◎", "✳", "⚙"][index]}</span>{item}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-badge"><span className={connected ? "status-dot connected" : "status-dot"} />{connected ? "Extension connected" : "Extension disconnected"}</div>
          <p>Analytics stay on this device. BrainWeb never reads or stores post text.</p>
          <span className="version-label">BRAINWEB · LOCAL ANALYTICS</span>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {activePage}</div>
          <div className="topbar-actions">
            <span className={connected ? "connection-label is-connected" : "connection-label"}>
              <i className="status-dot" />{connected ? "Connected" : "Not connected"}
            </span>
            <button className="icon-button" onClick={() => void refresh(true)} aria-label="Refresh analytics" title="Refresh analytics">
              <span className={refreshing ? "refresh-symbol spinning" : "refresh-symbol"}>↻</span>
            </button>
            <span className="avatar">B</span>
          </div>
        </header>

        <div className="page-heading">
          <div>
            <h1>{activePage}</h1>
            <p>{pageDescription[activePage]}</p>
          </div>
          <div className="current-date">{now?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>

        {error && <div className="connection-banner" role="status"><span>Connection issue</span><p>{error}</p><button onClick={() => void refresh(true)}>Try again</button></div>}
        {!trackingEnabled && connected && <div className="paused-banner"><span>Tracking is paused.</span> Resume it in Settings when you’re ready.</div>}
        {connected && stats && !hasRecordedStats(stats) && (
          <div className="paused-banner"><span>No analytics yet.</span> Browse X or LinkedIn with tracking enabled and your statistics will appear here.</div>
        )}

        {loading && !stats ? (
          <div className="loading-state"><span className="loader" />Connecting to local extension…</div>
        ) : !connected && !stats ? (
          <div className="disconnected-state">
            <div className="disconnected-mark">↗</div><h2>Connect your BrainWeb extension</h2>
            <p>Install and enable the BrainWeb extension in Chrome, then refresh this page. Your dashboard only reads analytics stored locally by the extension.</p>
            {extensionId && <button className="primary-button" onClick={() => void refresh(true)}>Try connecting again</button>}
            {extensionId
              ? <span>Extension ID for this Chrome profile: <code>{extensionId}</code></span>
              : <span>Open the dashboard using the BrainWeb extension popup.</span>}
          </div>
        ) : (
          <>
            {activePage !== "Settings" && (
              <PeriodFilter
                period={period}
                setPeriod={setPeriod}
                rangeLabel={periodRange}
              />
            )}
            <PageContent
              activePage={activePage}
              today={today}
              todayKey={todayKey}
              stats={stats}
              now={now}
              period={period}
              periodRange={periodRange}
              periodStats={selectedStats}
              selectedPlatforms={selectedPlatforms}
              hasSelectedData={hasSelectedData}
              periodKeys={periodKeys}
              chartKeys={chartKeys}
              trackingEnabled={trackingEnabled}
              toggleTracking={toggleTracking}
              clearAnalytics={clearAnalytics}
              exportCsv={exportCsv}
              exportJson={exportJson}
              connected={connected}
            />
          </>
        )}
        <footer className="page-footer">BrainWeb <span>·</span> Private by design. Built for intentional browsing.</footer>
      </section>
    </main>
  );
}

function PageContent({
  activePage,
  today,
  todayKey,
  stats,
  now,
  period,
  periodRange,
  periodStats,
  selectedPlatforms,
  hasSelectedData,
  periodKeys,
  chartKeys,
  trackingEnabled,
  toggleTracking,
  clearAnalytics,
  exportCsv,
  exportJson,
  connected,
}: {
  activePage: (typeof NAV_ITEMS)[number];
  today?: DailyStats;
  todayKey: string;
  stats: Analytics | null;
  now: Date | null;
  period: Period;
  periodRange: string;
  periodStats: ReturnType<typeof sumPeriod> | Analytics | null;
  selectedPlatforms: Record<PlatformKey, PlatformStats>;
  hasSelectedData: boolean;
  periodKeys: string[];
  chartKeys: string[];
  trackingEnabled: boolean;
  toggleTracking: () => void;
  clearAnalytics: () => void;
  exportCsv: () => void;
  exportJson: () => void;
  connected: boolean;
}) {
  if (!now) return <div className="loading-state"><span className="loader" />Loading local analytics…</div>;

  if (activePage === "Settings") {
    return (
      <div className="settings-layout">
        <section className="panel settings-panel">
          <div className="panel-heading"><div><h2>Tracking</h2><p>Control whether BrainWeb records new activity.</p></div><span className={connected ? "status-pill online" : "status-pill"}>{connected ? "Extension connected" : "Not connected"}</span></div>
          <div className="settings-row"><div><strong>{trackingEnabled ? "Tracking is on" : "Tracking is paused"}</strong><p>Only active, focused X and LinkedIn tabs are counted.</p></div><button className={trackingEnabled ? "toggle on" : "toggle"} role="switch" aria-checked={trackingEnabled} onClick={toggleTracking}><span /></button></div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading"><div><h2>Privacy</h2><p>BrainWeb is designed to work without a backend.</p></div><span className="privacy-lock">⌑ Local only</span></div>
          <ul className="privacy-list"><li>Analytics remain in Chrome’s local extension storage.</li><li>Post text, messages, credentials, and screenshots are never collected.</li><li>Temporary, salted post-ID hashes in tab session storage prevent reload duplicates; they are never sent with analytics.</li><li>The dashboard communicates only with your installed extension.</li></ul>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading"><div><h2>Your data</h2><p>Export a copy or permanently remove locally stored analytics.</p></div></div>
          <div className="settings-actions"><button className="secondary-button" onClick={exportCsv}>Export CSV</button><button className="secondary-button" onClick={exportJson}>Export JSON</button><button className="danger-button" onClick={clearAnalytics}>Clear analytics</button></div>
        </section>
        <section className="panel settings-panel"><div className="panel-heading"><div><h2>Connection</h2><p>Dashboard ↔ BrainWeb Chrome extension · Version 0.4.0</p></div><span className={connected ? "status-pill online" : "status-pill"}>{connected ? "Connected" : "Disconnected"}</span></div><p className="small-note">For production, add the dashboard’s exact HTTPS origin to <code>externally_connectable.matches</code> in extension/manifest.json and update the worker’s origin allowlist.</p></section>
      </div>
    );
  }

  if (activePage === "Activity") {
    return (
      <>
        <div className="metric-grid three">
          <Metric label={period === "All Time" ? "Lifetime active time" : "Active time"} value={formatTime(periodStats?.activeSeconds)} detail={periodRange} accent />
          <Metric label={period === "All Time" ? "Lifetime posts viewed" : "Posts viewed"} value={(periodStats?.totalPosts || 0).toLocaleString()} detail={periodRange} />
          <Metric label="Most active platform" value={mostUsedPlatform(selectedPlatforms)} detail={periodRange} />
        </div>
        <section className="panel chart-panel"><PanelHeading title="Daily active time" subtitle={periodRange} /><ActivityChart keys={chartKeys} daily={stats?.daily || {}} todayKey={todayKey} allTime={period === "All Time"} /></section>
        <section className="panel history-panel"><PanelHeading title="Daily history" subtitle="Recorded activity only" /><DailyHistory keys={periodKeys} daily={stats?.daily || {}} /></section>
      </>
    );
  }

  if (activePage === "Content Analytics") {
    return (
      <>
        <div className="metric-grid three">
          <Metric label={period === "All Time" ? "Lifetime content viewed" : "Content viewed"} value={(periodStats?.totalPosts || 0).toLocaleString()} detail={periodRange} accent />
          <Metric label={period === "All Time" ? "Lifetime organic posts" : "Organic posts"} value={(selectedPlatforms.x.organic + selectedPlatforms.linkedin.organic).toLocaleString()} detail={periodRange} />
          <Metric label={period === "All Time" ? "Lifetime sponsored posts" : "Sponsored posts"} value={(selectedPlatforms.x.sponsored + selectedPlatforms.linkedin.sponsored).toLocaleString()} detail={periodRange} />
        </div>
        <div className="content-grid">
          <section className="panel"><PanelHeading title="Content types" subtitle={periodRange} />{hasSelectedData ? <ContentBreakdown platforms={selectedPlatforms} /> : <EmptyState />}</section>
          <section className="panel"><PanelHeading title="Organic vs sponsored" subtitle={periodRange} />{hasSelectedData ? <SponsoredSummary platforms={selectedPlatforms} /> : <EmptyState />}</section>
        </div>
        <div className="content-grid">
          <PlatformCard name="X" data={selectedPlatforms.x} color="x-dot" />
          <PlatformCard name="LinkedIn" data={selectedPlatforms.linkedin} color="linkedin-dot" />
        </div>
      </>
    );
  }

  if (activePage === "Platforms") {
    return (
      <>
        <div className="metric-grid three">
          <Metric label={period === "All Time" ? "Lifetime active time" : "Active time"} value={formatTime(periodStats?.activeSeconds)} detail={periodRange} accent />
          <Metric label={period === "All Time" ? "Lifetime posts viewed" : "Posts viewed"} value={(periodStats?.totalPosts || 0).toLocaleString()} detail={periodRange} />
          <Metric label="Platform balance" value={platformBalance(selectedPlatforms)} detail={periodRange} />
        </div>
        <div className="content-grid"><PlatformCard name="X" data={selectedPlatforms.x} color="x-dot" /><PlatformCard name="LinkedIn" data={selectedPlatforms.linkedin} color="linkedin-dot" /></div>
        <section className="panel chart-panel"><PanelHeading title="Platform activity" subtitle={periodRange} /><PlatformTrend keys={chartKeys} daily={stats?.daily || {}} allTime={period === "All Time"} /></section>
      </>
    );
  }

  if (activePage === "Insights") {
    const postsInPeriod = periodStats?.totalPosts || 0;
    const yesterday = stats?.daily?.[dateKey(shiftDate(now, -1))];
    const sponsored = selectedPlatforms.x.sponsored + selectedPlatforms.linkedin.sponsored;
    const total = selectedPlatforms.x.posts + selectedPlatforms.linkedin.posts;
    const mostUsed = mostUsedPlatform(selectedPlatforms);
    const topType = mostConsumedType(selectedPlatforms);
    const insightItems = [
      postsInPeriod > 0 ? `You viewed ${postsInPeriod.toLocaleString()} ${postsInPeriod === 1 ? "post" : "posts"} in this period.` : "",
      (selectedPlatforms.x.activeSeconds + selectedPlatforms.linkedin.activeSeconds) > 0 ? `${mostUsed} accounts for the largest share of your tracked active time in this period.` : "",
      topType ? `${topType} is your most-consumed content type in this period.` : "",
      total > 0 ? `Sponsored content represents ${Math.round((sponsored / total) * 100)}% of classified posts in this period.` : "",
      period === "Today" && yesterday && today && today.activeSeconds !== yesterday.activeSeconds ? `Your active time is ${today.activeSeconds > yesterday.activeSeconds ? "up" : "down"} ${formatTime(Math.abs(today.activeSeconds - yesterday.activeSeconds))} compared with yesterday.` : "",
    ].filter(Boolean);
    return <section className="panel insights-panel"><PanelHeading title="Your patterns" subtitle={periodRange} />{insightItems.length ? insightItems.map((item, index) => <article className="insight-row" key={item}><span className="insight-index">0{index + 1}</span><p>{item}</p></article>) : <EmptyState>Insights will appear when there is enough activity to identify a pattern.</EmptyState>}</section>;
  }

  const activeSeconds = periodStats?.activeSeconds || 0;
  const postsViewed = periodStats?.totalPosts || 0;
  const totalPlatformActiveSeconds = selectedPlatforms.x.activeSeconds + selectedPlatforms.linkedin.activeSeconds;
  const xShare = totalPlatformActiveSeconds
    ? (selectedPlatforms.x.activeSeconds / totalPlatformActiveSeconds) * 100
    : 0;
  const linkedinShare = totalPlatformActiveSeconds
    ? (selectedPlatforms.linkedin.activeSeconds / totalPlatformActiveSeconds) * 100
    : 0;

  return (
    <>
      <div className="metric-grid">
        <Metric label={period === "All Time" ? "Lifetime active time" : "Active time"} value={formatTime(activeSeconds)} detail={periodRange} accent />
        <Metric label={period === "All Time" ? "Lifetime posts viewed" : "Posts viewed"} value={postsViewed.toLocaleString()} detail={periodRange} />
        <Metric label="X active time" value={formatTime(selectedPlatforms.x.activeSeconds)} detail={`${selectedPlatforms.x.posts.toLocaleString()} posts · ${periodRange}`} />
        <Metric label="LinkedIn active time" value={formatTime(selectedPlatforms.linkedin.activeSeconds)} detail={`${selectedPlatforms.linkedin.posts.toLocaleString()} posts · ${periodRange}`} />
      </div>
      <div className="overview-grid">
        <section className="panel chart-panel overview-chart"><PanelHeading title="Your activity" subtitle={periodRange} right={<span className="chart-total">{period === "All Time" ? "Lifetime total" : "Period total"} · {formatTime(activeSeconds)}</span>} /><ActivityChart keys={chartKeys} daily={stats?.daily || {}} todayKey={todayKey} allTime={period === "All Time"} /></section>
        <section className="panel"><PanelHeading title="Platform comparison" subtitle={periodRange} /><PlatformMini name="X" data={selectedPlatforms.x} share={xShare} /><PlatformMini name="LinkedIn" data={selectedPlatforms.linkedin} share={linkedinShare} /></section>
      </div>
      <div className="overview-grid bottom-grid">
        <section className="panel"><PanelHeading title="Content breakdown" subtitle={periodRange} />{postsViewed ? <ContentBreakdown platforms={selectedPlatforms} /> : <EmptyState>No posts recorded in this period. Content details will appear as you browse.</EmptyState>}</section>
        <section className="panel privacy-panel"><div className="privacy-emblem">⌑</div><h3>Private by design</h3><p>BrainWeb stores analytics locally in your browser. We never collect post text, private messages, or browsing history.</p><span><i className="status-dot connected" /> Local storage enabled</span></section>
      </div>
      <p className="data-footnote">Last updated {stats?.updatedAt ? new Date(stats.updatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "when tracking activity is recorded"} · All dates use your browser’s local timezone.</p>
      <span className="sr-only">{todayKey}</span>
    </>
  );
}

function PeriodFilter({ period, setPeriod, rangeLabel }: { period: Period; setPeriod: (period: Period) => void; rangeLabel: string }) {
  return (
    <div className="period-control">
      <div className="period-filter" role="group" aria-label="Select analytics period">
        {PERIODS.map((item) => (
          <button key={item} className={period === item ? "selected" : ""} aria-pressed={period === item} onClick={() => setPeriod(item)}>
            {item}
          </button>
        ))}
      </div>
      <span className="period-range">{rangeLabel}</span>
    </div>
  );
}

function PanelHeading({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{right}</div>;
}

function PlatformMini({ name, data, share }: { name: string; data: PlatformStats; share: number }) {
  return <div className="platform-mini"><div className="platform-mini-top"><strong>{name}</strong><span>{formatTime(data.activeSeconds)}</span></div><div className="progress-track"><span style={{ width: `${share}%` }} /></div><div className="platform-mini-bottom"><span>{data.posts} posts · {Math.round(share)}% of active time</span><span>{data.organic} organic · {data.sponsored} sponsored</span></div></div>;
}

function SponsoredSummary({ platforms }: { platforms: Record<PlatformKey, PlatformStats> }) {
  const organic = platforms.x.organic + platforms.linkedin.organic;
  const sponsored = platforms.x.sponsored + platforms.linkedin.sponsored;
  const total = organic + sponsored;
  return <div className="sponsored-summary"><div className="sponsored-counts"><div><span>Organic</span><strong>{organic}</strong></div><div><span>Sponsored</span><strong>{sponsored}</strong></div></div><div className="stacked-track"><span className="organic-fill" style={{ width: `${total ? (organic / total) * 100 : 0}%` }} /><span className="sponsored-fill" style={{ width: `${total ? (sponsored / total) * 100 : 0}%` }} /></div><p className="small-note">{total ? `${Math.round((sponsored / total) * 100)}% of classified content was sponsored.` : "No sponsored or organic posts were recorded."}</p></div>;
}

function DailyHistory({ keys, daily }: { keys: string[]; daily: Analytics["daily"] }) {
  const rows = keys.filter((key) => daily[key]).slice().reverse();
  if (!rows.length) return <EmptyState>No daily records exist for this period.</EmptyState>;
  return <div className="history-table"><div className="history-header"><span>Date</span><span>Active time</span><span>Posts viewed</span><span>Platforms</span></div>{rows.map((key) => { const day = daily[key]; const x = platformFor(day, "x"); const linkedin = platformFor(day, "linkedin"); return <div className="history-row" key={key}><strong>{dateLabel(key, true)}</strong><span>{formatTime(day.activeSeconds)}</span><span>{day.totalPosts || 0}</span><span>X {x.posts} · LinkedIn {linkedin.posts}</span></div>; })}</div>;
}

function PlatformTrend({ keys, daily, allTime = false }: { keys: string[]; daily: Analytics["daily"]; allTime?: boolean }) {
  const max = Math.max(1, ...keys.flatMap((key) => [platformFor(daily[key], "x").activeSeconds, platformFor(daily[key], "linkedin").activeSeconds]));
  if (!keys.some((key) => platformFor(daily[key], "x").activeSeconds || platformFor(daily[key], "linkedin").activeSeconds)) return <EmptyState>No platform activity for this period.</EmptyState>;
  return <div className={`activity-chart platform-trend${allTime ? " all-time-chart" : ""}`}>{keys.map((key) => { const x = platformFor(daily[key], "x").activeSeconds; const linkedin = platformFor(daily[key], "linkedin").activeSeconds; return <div className="chart-column" key={key} title={`${dateLabel(key)} · X ${formatTime(x)} · LinkedIn ${formatTime(linkedin)}`}><span className="chart-value">{formatTime(x + linkedin)}</span><div className="chart-bar-track trend-track"><span className="trend-x" style={{ height: `${(x / max) * 100}%` }} /><span className="trend-linkedin" style={{ height: `${(linkedin / max) * 100}%` }} /></div><span className="chart-label">{dateLabel(key, true).split(" ")[0]}</span></div>; })}<div className="chart-legend"><span><i className="legend-x" /> X</span><span><i className="legend-linkedin" /> LinkedIn</span></div></div>;
}

function mostUsedPlatform(platforms: Record<PlatformKey, PlatformStats>): string {
  if (!platforms.x.activeSeconds && !platforms.linkedin.activeSeconds) return "No activity";
  return platforms.x.activeSeconds >= platforms.linkedin.activeSeconds ? "X" : "LinkedIn";
}

function platformBalance(platforms: Record<PlatformKey, PlatformStats>): string {
  const total = platforms.x.activeSeconds + platforms.linkedin.activeSeconds;
  if (!total) return "No activity";
  return platforms.x.activeSeconds >= platforms.linkedin.activeSeconds ? "X leads" : "LinkedIn leads";
}

function mostConsumedType(platforms: Record<PlatformKey, PlatformStats>): string {
  const counts: Record<ContentKey, number> = { text: 0, video: 0, article: 0, image: 0 };
  (["x", "linkedin"] as const).forEach((platform) => {
    (["text", "video", "article", "image"] as const).forEach((type) => { counts[type] += platforms[platform].breakdown[type]; });
  });
  const [key, count] = (Object.entries(counts) as [ContentKey, number][]).sort((a, b) => b[1] - a[1])[0];
  if (!count) return "";
  return { text: "Text posts", video: "Videos", article: "Articles", image: "Images" }[key];
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadFile(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
