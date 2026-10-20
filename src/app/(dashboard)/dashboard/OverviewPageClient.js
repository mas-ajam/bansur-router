"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, Badge } from "@/shared/components";
import {
  AI_PROVIDERS,
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  FREE_PROVIDERS,
  FREE_TIER_PROVIDERS,
} from "@/shared/constants/providers";
import {
  parseQuotaData,
  getRemainingPercentage,
  getConnectionLabel,
} from "./usage/components/ProviderLimits/utils";

// Phase 3 — Overview (audit §II.4, O-01..O-08).
// Class-C fields with no real source render "—" and are flagged in the
// phase report: O-02-C delta/peak, O-03-C RTK tokens saved, O-05-C
// fallback events, O-07-C current route + uptime, O-08 Tool/Latency/
// fallback flag on recent requests. Status codes are only shown when
// the payload carries a numeric code (usageHistory status is "ok";
// the numeric upstream code is not in the stats shape).

const fmt = (n) => new Intl.NumberFormat("en-US").format(n || 0);

const ghostLinkClass =
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap border font-medium transition-colors bg-transparent border-transparent text-text-main hover:bg-[#eef0f1] px-2.5 py-1 text-[12.5px] rounded-md";

const dotOn = "inline-block w-2 h-2 rounded-full shrink-0 bg-brand-500";
const dotWarn =
  "inline-block w-2 h-2 rounded-full shrink-0 bg-white border-[2.5px] border-brand-500";

function providerName(providerId) {
  return AI_PROVIDERS[providerId]?.name || providerId || "—";
}

function parseStatus(status) {
  if (status == null || status === "") return { isError: false, code: null };
  if (typeof status === "number")
    return { isError: status >= 400, code: status };
  const s = String(status).trim().toLowerCase();
  if (/^\d+$/.test(s)) {
    const code = parseInt(s, 10);
    return { isError: code >= 400, code };
  }
  if (s.includes("error") || s.includes("fail")) return { isError: true, code: null };
  return { isError: false, code: null };
}

function StatusCell({ status }) {
  const { isError, code } = parseStatus(status);
  const label = `${isError ? "ERROR" : "OK"}${code ? ` ${code}` : ""}`;
  if (isError) {
    return (
      <span className="font-mono text-[11.5px] font-semibold underline underline-offset-[3px]">
        {label}
      </span>
    );
  }
  return <span className="font-mono text-[11.5px] font-semibold">{label}</span>;
}

function formatTime(timestamp) {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function tierNames(providers) {
  return providers
    .filter((p) => p && !p.hidden)
    .map((p) => p.name)
    .filter(Boolean)
    .slice(0, 4);
}

const TIERS = [
  {
    name: "Subscription",
    names: tierNames(Object.values(OAUTH_PROVIDERS)),
    suffix: " — serving first",
    tag: <Badge variant="primary">Active</Badge>,
  },
  {
    name: "Cheap",
    names: tierNames(Object.values(APIKEY_PROVIDERS)),
    suffix: " — next in line",
    tag: <Badge>Standby</Badge>,
  },
  {
    name: "Free",
    names: tierNames([
      ...Object.values(FREE_PROVIDERS),
      ...Object.values(FREE_TIER_PROVIDERS),
    ]),
    suffix: " — last resort",
    tag: <Badge>Standby</Badge>,
  },
];

const TOTAL_PROVIDERS = Object.values(AI_PROVIDERS).filter((p) => !p.hidden).length;

function KvRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px] last:border-b-0">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-[12.5px] text-right">{value}</span>
    </div>
  );
}

export default function OverviewPageClient() {
  const [stats, setStats] = useState(null);
  const [connections, setConnections] = useState(null);
  const [quotaRows, setQuotaRows] = useState([]);
  const [quotaConnections, setQuotaConnections] = useState(null);
  const [port, setPort] = useState("667");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.port) {
      setPort(window.location.port);
    }
  }, []);

  // Requests today + recent requests (O-02 value, O-08).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage/stats?period=today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Active providers / accounts connected (O-04): registry + /api/providers.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setConnections(data?.connections || []);
      })
      .catch(() => {
        if (!cancelled) setConnections([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Quota snapshot (O-06): same connection source as the Quota screen
  // (/api/providers/client), first parsed quota per connection via
  // /api/usage/[connectionId]; failures are skipped.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "100",
          accountStatus: "all",
          sort: "priority",
        });
        const res = await fetch(`/api/providers/client?${params.toString()}`);
        if (!res.ok) throw new Error("connections fetch failed");
        const data = await res.json();
        const conns = data.connections || [];
        if (cancelled) return;
        setQuotaConnections(conns);

        const rows = [];
        for (const conn of conns.slice(0, 12)) {
          if (rows.length >= 5) break;
          try {
            const r = await fetch(`/api/usage/${conn.id}`);
            if (!r.ok) continue;
            const usage = await r.json();
            if (!usage || typeof usage !== "object") continue;
            const parsed = parseQuotaData(conn.provider, usage);
            const first = parsed.find((q) => q && q.name !== "error");
            if (!first) continue;

            const isPercent =
              first.remainingPercentage !== undefined ||
              Number(first.total) === 100;
            let pct;
            let right;
            if (first.unlimited) {
              pct = 100;
              right = "Unlimited";
            } else if (isPercent) {
              pct = getRemainingPercentage(first);
              right = `${pct}% left`;
            } else {
              const total = Number(first.total) || 0;
              const used = Number(first.used) || 0;
              const remaining = Math.max(0, total - used);
              pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
              right = `${fmt(remaining)} / ${fmt(total)} credits`;
            }

            rows.push({
              id: conn.id,
              providerLabel: providerName(conn.provider),
              account: getConnectionLabel(conn) || "",
              pct: Math.max(0, Math.min(100, pct)),
              right,
            });
            if (!cancelled) setQuotaRows([...rows]);
          } catch {
            // Skip connections whose quota fetch fails (per spec).
          }
        }
        if (!cancelled) setQuotaRows(rows);
      } catch {
        if (!cancelled) setQuotaConnections([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeConnections = (connections || []).filter((c) => c.isActive !== false);
  const activeProviders = new Set(activeConnections.map((c) => c.provider)).size;
  const recentRequests = stats?.recentRequests || [];

  const thClass =
    "text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap";
  const thNumClass = `${thClass} text-right font-mono text-[12.5px]`;
  const tdClass = "px-3.5 py-2.5 border-b border-border align-middle";
  const tdNumClass = `${tdClass} text-right font-mono text-[12.5px]`;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Overview</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">
          Your local gateway at a glance — traffic, quota headroom, and which tier is carrying your tools right now.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        {/* Stat cards */}
        <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-4">
          <Card>
            <div className="text-xs font-medium text-text-muted mb-2 flex items-center gap-[7px]">
              <span className={dotOn} />
              Requests today
            </div>
            <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">
              {stats ? fmt(stats.totalRequests) : "—"}
            </div>
            {/* O-02-C: delta vs yesterday + peak time are not in the stats shape — omitted. */}
          </Card>

          <Card>
            <div className="text-xs font-medium text-text-muted mb-2 flex items-center gap-[7px]">
              <span className={dotOn} />
              Tokens saved by RTK
            </div>
            <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">—</div>
            {/* O-03-C: no RTK telemetry source exists — Phase 4. */}
          </Card>

          <Card>
            <div className="text-xs font-medium text-text-muted mb-2 flex items-center gap-[7px]">
              <span className={dotOn} />
              Active providers
            </div>
            <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">
              {connections ? (
                <>
                  {activeProviders}
                  <span className="text-[15px] text-text-subtle"> / {TOTAL_PROVIDERS}</span>
                </>
              ) : (
                "—"
              )}
            </div>
            {connections ? (
              <div className="text-xs text-text-muted mt-[7px]">
                <b className="font-mono font-semibold text-text-main">{activeConnections.length}</b>{" "}
                accounts connected
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="text-xs font-medium text-text-muted mb-2 flex items-center gap-[7px]">
              <span className={dotWarn} />
              Fallback events
            </div>
            <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">—</div>
            {/* O-05-C: no fallback-event log exists — Phase 4. */}
          </Card>
        </div>

        {/* Quota snapshot + Tier status */}
        <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2">
          <Card padding="none">
            <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
              <h3 className="text-[13.5px] font-semibold">Quota snapshot</h3>
              <div className="flex-1" />
              <Link href="/dashboard/quota" className={ghostLinkClass}>
                Open Quota Tracker
              </Link>
            </div>
            <div className="px-[18px] py-4 flex flex-col gap-[15px]">
              {quotaConnections && quotaConnections.length === 0 ? (
                <p className="text-xs text-text-muted">No accounts connected yet</p>
              ) : quotaRows.length === 0 ? (
                <p className="text-xs text-text-muted">
                  {quotaConnections ? "No quota data available yet" : "Loading quotas…"}
                </p>
              ) : (
                quotaRows.map((row) => (
                  <div key={row.id}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                        {row.providerLabel} ·{" "}
                        <span className="font-mono text-[12px]">{row.account}</span>
                      </span>
                      <span className="font-mono text-[12px]">{row.right}</span>
                    </div>
                    <div className="h-[6px] rounded-full bg-[#e7eaec] overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card padding="none">
            <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
              <h3 className="text-[13.5px] font-semibold">Tier status</h3>
              <div className="flex-1" />
              <Badge>Auto fallback on</Badge>
            </div>
            <div className="px-[18px] py-1.5">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className="flex items-center gap-3.5 py-[13px] border-b border-border last:border-b-0"
                >
                  <span className={dotOn} />
                  <div className="flex-1 min-w-0">
                    <b className="block text-[13.5px] font-semibold">{tier.name}</b>
                    <span className="text-[12.5px] text-text-muted">
                      {tier.names.join(", ")}
                      {tier.suffix}
                    </span>
                  </div>
                  {tier.tag}
                </div>
              ))}
              <div className="h-px bg-border my-[18px]" />
              {/* O-07-C: current route + uptime are not exposed — Phase 4. */}
              <KvRow label="Current route" value="—" />
              <KvRow label="Uptime (this session)" value="—" />
              <KvRow label="Listening on" value={`0.0.0.0:${port}`} />
            </div>
          </Card>
        </div>

        {/* Recent requests */}
        <Card padding="none">
          <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
            <h3 className="text-[13.5px] font-semibold">Recent requests</h3>
            <div className="flex-1" />
            <Link href="/dashboard/console-log" className={ghostLinkClass}>
              Open Console Log
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
              <thead>
                <tr>
                  <th className={thClass}>Time</th>
                  <th className={thClass}>Tool</th>
                  <th className={thClass}>Model</th>
                  <th className={thClass}>Provider</th>
                  <th className={thClass}>Status</th>
                  <th className={thNumClass}>Latency</th>
                  <th className={thNumClass}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`${tdClass} text-xs text-text-muted`}>
                      No requests yet today
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((r, i) => (
                    <tr key={`${r.timestamp || ""}-${i}`}>
                      <td className={`${tdClass} font-mono text-[12.5px]`}>
                        {formatTime(r.timestamp)}
                      </td>
                      <td className={tdClass}>—</td>
                      <td className={`${tdClass} font-mono text-[12.5px]`}>{r.model || "—"}</td>
                      <td className={tdClass}>{providerName(r.provider)}</td>
                      <td className={tdClass}>
                        <StatusCell status={r.status} />
                      </td>
                      <td className={tdNumClass}>—</td>
                      <td className={tdNumClass}>
                        {fmt((r.promptTokens || 0) + (r.completionTokens || 0))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
