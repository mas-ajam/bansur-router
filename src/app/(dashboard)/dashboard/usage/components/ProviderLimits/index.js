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
  REFRESH_INTERVAL_MS,
  CLAUDE_REFRESH_INTERVAL_MS,
} from "./utils";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import SpecIcon from "@/shared/components/SpecIcon";
import { AI_PROVIDERS } from "@/shared/constants/providers";

// Phase-2 parity (audit Q-01..Q-06): the artifact Quota Tracker has no
// toolbar, no filters and no pagination — one quiet card per connection.
// Connections are fetched in a single large page so every account renders.
const CONNECTIONS_PAGE_SIZE = 100;

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
            const quotas = quota?.quotas || [];
            const accountLabel = getConnectionLabel(conn);

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
                </div>

                {isLoading ? (
                  <p className="text-xs text-text-muted">Loading quota…</p>
                ) : error || quota?.message ? (
                  <p className="text-xs text-text-muted">{error || quota.message}</p>
                ) : quotas.length === 0 ? (
                  <p className="text-xs text-text-muted">No quota data reported for this account.</p>
                ) : (
                  <>
                    {quotas.map((q, idx) => {
                      const pct = Math.max(0, Math.min(100, getRemainingPercentage(q)));
                      return (
                        <div key={`${q.name}-${idx}`}>
                          <div className="flex items-baseline justify-between gap-3.5 mb-[5px]">
                            <span className="text-xs text-text-muted">{q.name}</span>
                            <span className="font-mono text-[12.5px]">{windowValue(q)}</span>
                          </div>
                          <div className="h-[6px] rounded-full bg-[#e7eaec] overflow-hidden mb-3.5">
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
