"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  parseQuotaData,
  getRemainingPercentage,
  getConnectionLabel,
  sortVisibleConnections,
  buildLoadingState,
  filterQuotaStateByConnections,
  getSafeTotals,
  setQuotaCache,
  filterQuotasByVisibility,
  getHiddenQuotaRows,
  getQuotaVisibilityKey,
  REFRESH_INTERVAL_MS,
  CLAUDE_REFRESH_INTERVAL_MS,
} from "./utils";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import SpecIcon from "@/shared/components/SpecIcon";
import { ConfirmModal, Modal } from "@/shared/components";
import Tooltip from "@/shared/components/Tooltip";
import AutoPingScheduleModal from "@/app/(dashboard)/dashboard/providers/[id]/AutoPingScheduleModal";
import { getScheduleSlotLabels } from "@/shared/services/quotaPingSchedule";
import { AI_PROVIDERS } from "@/shared/constants/providers";

// Phase-2 parity (audit Q-01..Q-06): the artifact Quota Tracker has no
// toolbar, no filters and no pagination — one quiet card per connection.
// Connections are fetched in a single large page so every account renders.
// Option 2 restoration (batch 3, Q-07): the per-connection controls
// return as ADDITIONS around the spec card grid — reset-credits actions
// + auto-ping configuration on the cards themselves, hide/unhide of
// quota rows honoring the quotaVisibility setting, and a slim toolbar
// row (unhide-all) that only appears while rows are hidden. The spec
// cards keep their layout; the old toolbar/filters/pagination stay gone.
const CONNECTIONS_PAGE_SIZE = 100;

const AUTO_PING_SETTINGS_KEYS = {
  claude: "claudeAutoPing",
  codex: "codexAutoPing",
};

const AUTO_PING_TOOLTIPS = {
  claude: "When your 5h quota runs out, auto-sends a request the moment it resets so a new window starts right away.",
  codex: "Auto-starts the next 5h Codex window after reset by sending a tiny request. Consumes a small amount of quota.",
};

function getCodexResetCreditCount(quota) {
  const value = quota?.raw?.resetCredits?.availableCount;
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

const CLAUDE_RESET_LIMIT_NAMES = {
  five_hour: "session",
  seven_day: "weekly",
  seven_day_overage_included: "weekly",
  seven_day_opus: "Opus weekly",
  seven_day_sonnet: "Sonnet weekly",
};

function formatClaudeResetClears(clears) {
  const names = [...new Set((clears || []).map((c) => CLAUDE_RESET_LIMIT_NAMES[c]).filter(Boolean))];
  return names.length ? `${names.join(" + ")} limits` : "limits";
}

function claudeGrantStatus(grant) {
  if (grant.resetsLeft <= 0) return "used";
  if (grant.paused) return "paused";
  if (grant.endsAt && new Date(grant.endsAt).getTime() <= Date.now()) return "expired";
  if (grant.usableNow) return "usable now";
  if (grant.startsAt && new Date(grant.startsAt).getTime() > Date.now()) return "not started";
  return grant.useRequiresLimit ? "at limit only" : "unavailable";
}

function formatCreditDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "N/A";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRemaining(value) {
  if (!value) return "N/A";
  const diffMs = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return "N/A";
  if (diffMs <= 0) return "Expired";
  const totalHours = Math.ceil(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

function providerLabel(providerId) {
  return AI_PROVIDERS[providerId]?.name || providerId;
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
}

// Artifact countdown format: "48m" / "2h 14m" / "3d 6h".
function formatResetDuration(resetAt) {
  if (!resetAt) return null;
  const diffMs = new Date(resetAt).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return null;
  if (diffMs <= 0) return "—";
  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) return `${totalHours}h ${minutes}m`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${hours}h`;
}

function resetLabelFor(quota) {
  const name = String(quota?.name || "").toLowerCase();
  if (name.includes("session") || name.includes("5h") || name.includes("5-hour") || name.includes("5 hour")) {
    return "Session resets in";
  }
  if (name.includes("week") || name.includes("7d")) {
    return "Weekly resets in";
  }
  return "Resets in";
}

// Percent-based windows (total is a 0–100 scale, or the parser supplied an
// explicit remainingPercentage) read "62% left"; count-based windows
// (credits, premium requests) read "234 / 300".
function isPercentBased(quota) {
  return quota?.remainingPercentage !== undefined || Number(quota?.total) === 100;
}

function windowValue(quota) {
  if (quota?.unlimited) return "Unlimited";
  if (isPercentBased(quota)) {
    return `${getRemainingPercentage(quota)}% left`;
  }
  const total = Number(quota?.total) || 0;
  const used = Number(quota?.used) || 0;
  const remaining = Math.max(0, total - used);
  return `${formatCount(remaining)} / ${formatCount(total)}${quota?.unit ? ` ${quota.unit}` : ""}`;
}

export default function ProviderLimits() {
  const [connections, setConnections] = useState([]);
  const [quotaData, setQuotaData] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [totals, setTotals] = useState({
    eligibleConnections: 0,
    providerFilteredConnections: 0,
  });
  // Restored Q-07 state: auto-ping configs, quota row visibility, and
  // the reset-credits flows (confirm + credits view).
  const [autoPingConfigs, setAutoPingConfigs] = useState({ claude: {}, codex: {} });
  const [scheduleConnection, setScheduleConnection] = useState(null);
  const [quotaVisibility, setQuotaVisibility] = useState({});
  const [resettingLimitId, setResettingLimitId] = useState(null);
  const [resetConfirmState, setResetConfirmState] = useState(null);
  const [resetCreditsState, setResetCreditsState] = useState(null);

  const tickCountRef = useRef(0);
  const refreshingRef = useRef(false);

  const fetchConnections = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(CONNECTIONS_PAGE_SIZE),
        accountStatus: "all",
        sort: "priority",
      });

      const response = await fetch(
        `/api/providers/client?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch connections");

      const data = await response.json();
      const connectionList = data.connections || [];
      const nextTotals = getSafeTotals(data.totals, connectionList.length);

      setConnections(connectionList);
      setTotals(nextTotals);
      return connectionList;
    } catch (error) {
      console.error("Error fetching connections:", error);
      setConnections([]);
      setTotals({ eligibleConnections: 0, providerFilteredConnections: 0 });
      return [];
    }
  }, []);

  // Fetch quota for a specific connection
  const fetchQuota = useCallback(async (connectionId, provider, { force = false } = {}) => {
    setLoading((prev) => ({ ...prev, [connectionId]: true }));
    setErrors((prev) => ({ ...prev, [connectionId]: null }));

    try {
      const url = `/api/usage/${connectionId}${force ? "?force=1" : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || response.statusText;

        // Handle different error types gracefully
        if (response.status === 404) {
          // Connection not found - skip silently
          console.warn(
            `[ProviderLimits] Connection not found for ${provider}, skipping`,
          );
          return;
        }

        if (response.status === 401) {
          // Auth error - show message instead of throwing
          console.warn(
            `[ProviderLimits] Auth error for ${provider}:`,
            errorMsg,
          );
          const quotaEntry = {
            quotas: [],
            message: errorMsg,
          };
          setQuotaData((prev) => ({
            ...prev,
            [connectionId]: quotaEntry,
          }));
          setQuotaCache(connectionId, quotaEntry);
          return;
        }

        throw new Error(`HTTP ${response.status}: ${errorMsg}`);
      }

      const data = await response.json();

      // Parse quota data using provider-specific parser
      const parsedQuotas = parseQuotaData(provider, data);

      const quotaEntry = {
        quotas: parsedQuotas,
        plan: data.plan || null,
        message: data.message || null,
        raw: data,
      };

      setQuotaData((prev) => ({
        ...prev,
        [connectionId]: quotaEntry,
      }));
      setQuotaCache(connectionId, quotaEntry);
    } catch (error) {
      console.error(
        `[ProviderLimits] Error fetching quota for ${provider} (${connectionId}):`,
        error,
      );
      setErrors((prev) => ({
        ...prev,
        [connectionId]: error.message || "Failed to fetch quota",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [connectionId]: false }));
    }
  }, []);

  // ─── Restored Q-07: settings-backed controls ───
  // Load auto-ping per-connection configs + quota visibility once.
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((s) => {
        setAutoPingConfigs({
          claude: s?.claudeAutoPing || {},
          codex: s?.codexAutoPing || {},
        });
        setQuotaVisibility(s?.quotaVisibility || {});
      })
      .catch(() => {});
  }, []);

  const handleSaveAutoPing = useCallback(async (connectionId, provider, { reactive, schedule }) => {
    const settingsKey = AUTO_PING_SETTINGS_KEYS[provider];
    if (!settingsKey) return;

    const previous = autoPingConfigs;
    const prevCfg = autoPingConfigs[provider] || {};
    const nextProviderCfg = {
      ...prevCfg,
      connections: { ...(prevCfg.connections || {}), [connectionId]: reactive },
      schedules: { ...(prevCfg.schedules || {}), [connectionId]: schedule },
    };
    const nextConfigs = { ...autoPingConfigs, [provider]: nextProviderCfg };
    setAutoPingConfigs(nextConfigs);

    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const s = r.ok ? await r.json() : {};
      const fullCfg = {
        ...(s[settingsKey] || {}),
        connections: nextProviderCfg.connections,
        schedules: nextProviderCfg.schedules,
      };
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [settingsKey]: fullCfg }),
      });
    } catch {
      setAutoPingConfigs(previous);
    }
  }, [autoPingConfigs]);

  const updateQuotaVisibility = useCallback(async (nextVisibility, previousVisibility) => {
    setQuotaVisibility(nextVisibility);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotaVisibility: nextVisibility }),
      });
      if (!response.ok) throw new Error("Failed to update quota visibility");
    } catch (error) {
      console.error("Error updating quota visibility:", error);
      setQuotaVisibility(previousVisibility);
    }
  }, []);

  const handleHideQuota = useCallback((provider, quota) => {
    const key = getQuotaVisibilityKey(quota);
    if (!provider || !key) return;

    const previous = quotaVisibility;
    const providerVisibility = previous[provider] || {};
    const hidden = new Set(providerVisibility.hidden || []);
    hidden.add(key);
    if (provider === "antigravity") {
      if (key === "gemini") {
        for (const k of hidden) {
          if (k.startsWith("gemini-") && !k.includes("image")) hidden.delete(k);
        }
      } else if (key === "claude") {
        for (const k of hidden) {
          if (k.startsWith("claude-")) hidden.delete(k);
        }
      }
    }
    const next = {
      ...previous,
      [provider]: {
        ...providerVisibility,
        hidden: [...hidden],
      },
    };
    updateQuotaVisibility(next, previous);
  }, [quotaVisibility, updateQuotaVisibility]);

  const handleShowQuota = useCallback((provider, quota) => {
    const key = getQuotaVisibilityKey(quota);
    if (!provider || !key) return;

    const previous = quotaVisibility;
    const providerVisibility = previous[provider] || {};
    const hidden = new Set(providerVisibility.hidden || []);
    hidden.delete(key);
    if (provider === "antigravity") {
      if (key === "gemini") {
        for (const k of hidden) {
          if (k.startsWith("gemini-") && !k.includes("image")) hidden.delete(k);
        }
      } else if (key === "claude") {
        for (const k of hidden) {
          if (k.startsWith("claude-")) hidden.delete(k);
        }
      }
    }
    const next = {
      ...previous,
      [provider]: {
        ...providerVisibility,
        hidden: [...hidden],
      },
    };
    updateQuotaVisibility(next, previous);
  }, [quotaVisibility, updateQuotaVisibility]);

  const handleResetCodexLimit = useCallback(
    async (connectionId, provider) => {
      if ((provider !== "codex" && provider !== "claude") || resettingLimitId) return;

      setResettingLimitId(connectionId);
      setErrors((prev) => ({ ...prev, [connectionId]: null }));

      try {
        const response = provider === "claude"
          ? await fetch(`/api/usage/${connectionId}/claude-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grantId: quotaData[connectionId]?.raw?.resetCredits?.nextGrantId }),
          })
          : await fetch(`/api/usage/${connectionId}/codex-reset-credits`, { method: "POST" });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || result.error || result.code || "Failed to reset limit");
        }

        await fetchQuota(connectionId, provider, { force: true });
      } catch (error) {
        setErrors((prev) => ({ ...prev, [connectionId]: error.message || "Failed to reset limit" }));
      } finally {
        setResettingLimitId(null);
      }
    },
    [fetchQuota, resettingLimitId, quotaData],
  );

  // Claude grants already arrive with the usage read; no extra fetch
  const handleViewClaudeResets = useCallback((connection, resetCredits) => {
    setResetCreditsState({ connection, loading: false, error: null, data: { kind: "claude", ...resetCredits } });
  }, []);

  const handleViewCodexResetCredits = useCallback(async (connection) => {
    setResetCreditsState({ connection, loading: true, error: null, data: null });
    try {
      const response = await fetch(`/api/usage/${connection.id}/codex-reset-credits`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to load Codex reset credits");
      }
      const credits = Array.isArray(result.credits) ? [...result.credits] : [];
      credits.sort((a, b) => {
        const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
      setResetCreditsState({ connection, loading: false, error: null, data: { ...result, credits } });
    } catch (error) {
      setResetCreditsState({ connection, loading: false, error: error.message || "Failed to load Codex reset credits", data: null });
    }
  }, []);

  // Silent refresh (Q-01: no toolbar/countdown UI). Claude polls less often
  // because its usage endpoint rate-limits; a manual mount load always
  // fetches everything once.
  const refreshQuotas = useCallback(
    async ({ force = false } = {}) => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        const visibleConnections = await fetchConnections();

        setLoading(buildLoadingState(visibleConnections));
        setErrors((prev) =>
          filterQuotaStateByConnections(prev, visibleConnections),
        );
        setQuotaData((prev) =>
          filterQuotaStateByConnections(prev, visibleConnections),
        );

        const tick = (tickCountRef.current += 1);
        const claudeEvery = Math.round(CLAUDE_REFRESH_INTERVAL_MS / REFRESH_INTERVAL_MS);
        const targets = visibleConnections.filter(
          (conn) => force || conn.provider !== "claude" || tick % claudeEvery === 0,
        );

        await Promise.all(
          targets.map((conn) => fetchQuota(conn.id, conn.provider, { force })),
        );
      } catch (error) {
        console.error("Error refreshing quotas:", error);
      } finally {
        refreshingRef.current = false;
      }
    },
    [fetchConnections, fetchQuota],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConnectionsLoading(true);
      await refreshQuotas({ force: true });
      if (!cancelled) setConnectionsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshQuotas]);

  // Background interval + refresh when the tab becomes visible again.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) refreshQuotas();
    }, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) refreshQuotas();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshQuotas]);

  const sortedConnections = useMemo(
    () =>
      sortVisibleConnections(connections, quotaData, false, "all", "default"),
    [connections, quotaData],
  );

  // Total hidden quota rows across all connections (drives the slim
  // toolbar's unhide-all affordance).
  const totalHiddenRows = useMemo(
    () =>
      connections.reduce(
        (sum, conn) =>
          sum + getHiddenQuotaRows(conn.provider, quotaData[conn.id]?.quotas || [], quotaVisibility).length,
        0,
      ),
    [connections, quotaData, quotaVisibility],
  );

  const pageHead = (
    <div>
      <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Quota Tracker</h2>
      <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Remaining headroom per account, with reset countdowns. The router reads these before choosing where a request lands.</p>
    </div>
  );

  if (!connectionsLoading && totals.eligibleConnections === 0) {
    return (
      <div className="flex flex-col gap-3.5">
        {pageHead}
        <Card>
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-border bg-surface-2 text-text-main mb-4">
              <SpecIcon size={30}>
                <path d="M12 3a9 9 0 1 0 9 9h-9z" />
                <path d="M15 2.5A9 9 0 0 1 21.5 9H15z" />
              </SpecIcon>
            </div>
            <p className="text-text-main font-medium mb-1">No accounts to track yet</p>
            <p className="text-sm text-text-muted max-w-md mx-auto">
              Connect a provider account and its quota will appear here with reset countdowns.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {pageHead}

      {/* Slim toolbar row (restored, Q-07): only present while quota
          rows are hidden somewhere — unhide-all in one click. */}
      {!connectionsLoading && totalHiddenRows > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="material-symbols-outlined text-[14px]">visibility_off</span>
          <span>
            {totalHiddenRows} quota row{totalHiddenRows === 1 ? "" : "s"} hidden
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => updateQuotaVisibility({}, quotaVisibility)}
            className="rounded-md border border-border px-2 py-1 font-medium text-text-main transition-colors hover:bg-surface-2"
          >
            Unhide all rows
          </button>
        </div>
      )}

      {connectionsLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <SpecIcon size={30} className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.2-8.56" />
          </SpecIcon>
          <p className="mt-3 text-sm">Loading quotas...</p>
        </div>
      ) : (
        <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-3">
          {sortedConnections.map((conn) => {
            const quota = quotaData[conn.id];
            const isLoading = loading[conn.id] && !quota;
            const error = errors[conn.id];
            const plan = quota?.plan || conn.plan || null;
            const isTopPlan = Boolean(plan) && String(plan).toLowerCase().includes("max");
            const rawQuotas = quota?.quotas || [];
            const quotas = filterQuotasByVisibility(conn.provider, rawQuotas, quotaVisibility);
            const hiddenQuotaRows = getHiddenQuotaRows(conn.provider, rawQuotas, quotaVisibility);
            const accountLabel = getConnectionLabel(conn);

            // Restored per-card actions (Q-07)
            const isCodex = conn.provider === "codex";
            const claudeReset = conn.provider === "claude" ? quota?.raw?.resetCredits : null;
            const resetLabel = isCodex ? "Codex reset credit" : "Claude limit reset";
            const resetCreditCount = getCodexResetCreditCount(quota);
            const isResettingLimit = resettingLimitId === conn.id;
            const autoPingCfg = autoPingConfigs[conn.provider] || {};
            const autoPingActive =
              autoPingCfg.connections?.[conn.id] === true ||
              autoPingCfg.schedules?.[conn.id]?.enabled === true;

            const kvRows = [];
            for (const q of quotas) {
              const duration = formatResetDuration(q.resetAt);
              if (duration) {
                kvRows.push({ key: `${q.name}-reset`, label: resetLabelFor(q), value: duration });
              }
            }

            return (
              <Card key={conn.id} className="min-w-0">
                <div className="flex items-start gap-2 mb-3.5">
                  <div className="grow min-w-0">
                    <div className="font-semibold text-sm leading-[1.25] truncate">
                      {providerLabel(conn.provider)}
                    </div>
                    {accountLabel ? (
                      <div className="text-xs text-text-muted font-mono truncate">
                        {accountLabel}
                      </div>
                    ) : null}
                  </div>
                  {plan ? (
                    <Badge variant={isTopPlan ? "primary" : "default"}>{plan}</Badge>
                  ) : null}
                  {/* Restored card actions: reset credits + auto-ping */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(isCodex || claudeReset) && (
                      <>
                        <Tooltip
                          text={
                            resetCreditCount > 0
                              ? claudeReset
                                ? `Use your reset now (${resetCreditCount} left, use by ${formatCreditDate(claudeReset.expiresAt)}) · refills ${formatClaudeResetClears(claudeReset.clears)}`
                                : `Use one ${resetLabel}. Available: ${resetCreditCount}`
                              : `No ${resetLabel}s available`
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setResetConfirmState({ connection: conn, resetCreditCount })}
                            disabled={resetCreditCount <= 0 || isLoading || isResettingLimit}
                            aria-label={
                              resetCreditCount > 0
                                ? `Use one ${resetLabel}. ${resetCreditCount} available.`
                                : `No ${resetLabel}s available`
                            }
                            className={`flex h-8 min-w-10 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                              resetCreditCount > 0
                                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                                : "border-black/10 bg-black/[0.02] text-text-muted dark:border-white/10 dark:bg-white/[0.03]"
                            }`}
                          >
                            <span className={`material-symbols-outlined text-[15px] ${isResettingLimit ? "animate-spin" : ""}`}>
                              {isResettingLimit ? "progress_activity" : "restart_alt"}
                            </span>
                            <span>{resetCreditCount}</span>
                          </button>
                        </Tooltip>
                        <Tooltip text={isCodex ? "View Codex reset credit expiry" : "View Claude Code reset expiry"}>
                          <button
                            type="button"
                            onClick={() => (isCodex ? handleViewCodexResetCredits(conn) : handleViewClaudeResets(conn, claudeReset))}
                            disabled={isLoading || isResettingLimit}
                            aria-label={isCodex ? "View Codex reset credit expiry" : "View Claude Code reset expiry"}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[17px]">schedule</span>
                          </button>
                        </Tooltip>
                      </>
                    )}
                    {AUTO_PING_SETTINGS_KEYS[conn.provider] && conn.authType === "oauth" && (() => {
                      const cfg = autoPingConfigs[conn.provider] || {};
                      const isReactive = cfg.connections?.[conn.id] === true;
                      const schedule = cfg.schedules?.[conn.id];
                      const isSchedule = schedule?.enabled === true;
                      const activeModes = [];
                      if (isReactive) activeModes.push("On reset");
                      if (isSchedule) {
                        const summary = getScheduleSlotLabels(schedule).join(" / ");
                        activeModes.push(`Scheduled (${summary || "active"})`);
                      }
                      const tooltipText = activeModes.length > 0
                        ? `Auto-ping active: ${activeModes.join(" + ")}. Click to configure.`
                        : AUTO_PING_TOOLTIPS[conn.provider];
                      return (
                      <Tooltip text={tooltipText}>
                        <button
                          type="button"
                          onClick={() => setScheduleConnection(conn)}
                          aria-label="Configure auto-ping"
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 ${autoPingActive ? "text-primary" : "text-text-muted"}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">bolt</span>
                        </button>
                      </Tooltip>
                      );
                    })()}
                  </div>
                </div>

                {isLoading ? (
                  <p className="text-xs text-text-muted">Loading quota…</p>
                ) : error || quota?.message ? (
                  <p className="text-xs text-text-muted">{error || quota.message}</p>
                ) : rawQuotas.length === 0 ? (
                  <p className="text-xs text-text-muted">No quota data reported for this account.</p>
                ) : (
                  <>
                    {quotas.map((q, idx) => {
                      const pct = Math.max(0, Math.min(100, getRemainingPercentage(q)));
                      return (
                        <div key={`${q.name}-${idx}`}>
                          <div className="flex items-baseline justify-between gap-3.5 mb-[5px]">
                            <span className="text-xs text-text-muted">{q.name}</span>
                            <span className="flex items-baseline gap-1.5">
                              <span className="font-mono text-[12.5px]">{windowValue(q)}</span>
                              <button
                                type="button"
                                onClick={() => handleHideQuota(conn.provider, q)}
                                aria-label={`Hide ${q.name} row`}
                                title="Hide this quota row"
                                className="translate-y-[2px] text-text-muted transition-colors hover:text-text-main"
                              >
                                <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                              </button>
                            </span>
                          </div>
                          <div className="h-[6px] rounded-full bg-surface-3 overflow-hidden mb-3.5">
                            <span
                              className="block h-full rounded-full bg-brand-500"
                              style={{ width: `${q.unlimited ? 100 : pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {kvRows.map((row) => (
                      <div
                        key={row.key}
                        className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px] last:border-b-0"
                      >
                        <span className="text-text-muted">{row.label}</span>
                        <span className="font-mono text-[12.5px] text-right">{row.value}</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Hidden rows for this card — click a chip to unhide */}
                {hiddenQuotaRows.length > 0 && (
                  <div className="mt-2 flex min-w-0 items-center gap-1 border-t border-black/5 pt-2 text-[10px] text-text-muted dark:border-white/5">
                    <span className="material-symbols-outlined shrink-0 text-[14px]">
                      visibility_off
                    </span>
                    <span className="shrink-0">Hidden:</span>
                    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap pb-1">
                      {hiddenQuotaRows.map((quotaRow) => (
                        <button
                          key={getQuotaVisibilityKey(quotaRow)}
                          type="button"
                          onClick={() => handleShowQuota(conn.provider, quotaRow)}
                          className="shrink-0 rounded-md border border-black/10 px-1.5 py-0.5 transition-colors hover:bg-black/5 hover:text-text-main dark:border-white/10 dark:hover:bg-white/5"
                          title="Show this quota row"
                        >
                          {quotaRow.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Reset-credits confirm (restored) */}
      <ConfirmModal
        isOpen={Boolean(resetConfirmState)}
        onClose={() => {
          if (!resettingLimitId) setResetConfirmState(null);
        }}
        onConfirm={async () => {
          const connection = resetConfirmState?.connection;
          if (!connection) return;
          await handleResetCodexLimit(connection.id, connection.provider);
          setResetConfirmState(null);
        }}
        title={resetConfirmState?.connection?.provider === "claude" ? "Reset Claude limits?" : "Reset Codex limit?"}
        message={resetConfirmState?.connection?.provider === "claude"
          ? `Refills your ${formatClaudeResetClears(quotaData[resetConfirmState.connection.id]?.raw?.resetCredits?.clears)} now for ${getConnectionLabel(resetConfirmState.connection) || "this account"} · your weekly reset day stays ${formatCreditDate(quotaData[resetConfirmState.connection.id]?.raw?.resetCredits?.weeklyResetsAt)}. This cannot be undone. Resets left: ${resetConfirmState.resetCreditCount ?? 0}.`
          : `Use 1 Codex reset credit for ${getConnectionLabel(resetConfirmState?.connection || {}) || "this account"}. This cannot be undone. Remaining credits: ${resetConfirmState?.resetCreditCount ?? 0}.`}
        confirmText="Reset limit"
        cancelText="Cancel"
        variant="danger"
        loading={Boolean(resettingLimitId)}
      />

      {/* Reset-credits view (restored): codex credit expiry / claude grants.
          The pre-removal hand-rolled overlay (hardcoded white/neutral-950)
          is rebuilt on the shared Modal so it follows the theme tokens. */}
      <Modal
        isOpen={Boolean(resetCreditsState)}
        onClose={() => setResetCreditsState(null)}
        title={resetCreditsState?.data?.kind === "claude" ? "Claude Code Limit Resets" : "Codex Reset Credit Expiry"}
        size="full"
      >
        {resetCreditsState && (
          <div className="flex flex-col gap-3">
            <p className="truncate text-xs text-text-muted">
              {getConnectionLabel(resetCreditsState.connection) || (resetCreditsState.data?.kind === "claude" ? "Claude account" : "Codex account")}
            </p>
            {resetCreditsState.loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                Loading reset credits...
              </div>
            ) : resetCreditsState.error ? (
              <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-main">
                {resetCreditsState.error}
              </div>
            ) : resetCreditsState.data?.kind === "claude" && resetCreditsState.data.grants?.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-brand border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
                  <span>{resetCreditsState.data.availableCount ?? 0} reset{resetCreditsState.data.availableCount === 1 ? "" : "s"} left</span>
                  <span>Weekly reset day: {formatCreditDate(resetCreditsState.data.weeklyResetsAt)}</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-text-muted dark:bg-white/[0.04]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Reset</th>
                        <th className="px-3 py-2 font-medium">Left</th>
                        <th className="px-3 py-2 font-medium">Refills</th>
                        <th className="px-3 py-2 font-medium">Use By</th>
                        <th className="px-3 py-2 font-medium">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(resetCreditsState.data.grants || []).map((grant) => (
                        <tr key={grant.id} className="border-t border-black/5 dark:border-white/5">
                          <td className="px-3 py-2">
                            <div className="text-text-main">{grant.label || grant.id}</div>
                            <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {claudeGrantStatus(grant)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums text-text-main">{grant.resetsLeft} / {grant.resetsTotal}</td>
                          <td className="px-3 py-2 text-text-muted">{formatClaudeResetClears(grant.clears)}</td>
                          <td className="px-3 py-2 text-text-main">{formatCreditDate(grant.endsAt)}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-text-main">{formatTimeRemaining(grant.endsAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : resetCreditsState.data?.credits?.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-brand border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
                  <span>{resetCreditsState.data.credits.length} reset credit{resetCreditsState.data.credits.length === 1 ? "" : "s"}</span>
                  <span>{resetCreditsState.data.availableCount ?? 0} available</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-text-muted dark:bg-white/[0.04]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Granted At</th>
                        <th className="px-3 py-2 font-medium">Expires At</th>
                        <th className="px-3 py-2 font-medium">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resetCreditsState.data.credits.map((credit, index) => (
                        <tr key={`${credit.status}-${credit.expiresAt || index}`} className="border-t border-black/5 dark:border-white/5">
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {credit.status || "unknown"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-text-muted">{formatCreditDate(credit.grantedAt)}</td>
                          <td className="px-3 py-2 text-text-main">{formatCreditDate(credit.expiresAt)}</td>
                          <td className="px-3 py-2 font-medium text-text-main">{formatTimeRemaining(credit.expiresAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-8 text-center text-sm text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
                {resetCreditsState.data?.kind === "claude" ? "No limit resets available for this account." : "No reset credit details returned for this account."}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Auto-ping configuration (restored): the scheduler backend never
          stopped; this is its per-connection config UI. */}
      {scheduleConnection && (
        <AutoPingScheduleModal
          isOpen={!!scheduleConnection}
          onClose={() => setScheduleConnection(null)}
          connection={scheduleConnection}
          reactive={autoPingConfigs[scheduleConnection.provider]?.connections?.[scheduleConnection.id] === true}
          schedule={autoPingConfigs[scheduleConnection.provider]?.schedules?.[scheduleConnection.id] || null}
          onSave={(result) => handleSaveAutoPing(scheduleConnection.id, scheduleConnection.provider, result)}
        />
      )}
    </div>
  );
}
