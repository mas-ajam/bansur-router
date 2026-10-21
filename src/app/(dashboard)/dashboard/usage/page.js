"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, SegmentedControl, RequestLogger } from "@/shared/components";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import TopologySection from "./components/TopologySection";
import RequestDetailsTab from "./components/RequestDetailsTab";

// Phase 3 — Usage restructure (audit §II.10, U-01..U-06).
// Single fixed "last 7 days" scroll page: stats -> chart -> two tables.
// Option 2 restoration (batch 3): the U-05/U-07 extras return as
// ADDITIONS — a small tab switch ("Overview" = the spec content below,
// unchanged and still the default; "Request Logger" = RequestLogger +
// RequestDetailsTab, whose rows open the Request Details modal) and
// the ProviderTopology graph as an extra section at the end of the
// Overview scroll. The period SegmentedControl stays removed.
// Phase 4 closed the class-C flags: U-03 "Time saved by fallback" and
// the success-rate delta's "recovered by fallback" count read the
// fallback aggregates on /api/usage/stats?period=7d (telemetry store,
// credited only when a request actually recovered); the Requests (7d)
// delta reads the previous-period aggregate from the same payload.
// U-06-C per-provider errors / avg latency come from the
// request-details store (observability) — cells render "—" when that
// store has no rows or a query fails.

const fmt = (n) => new Intl.NumberFormat("en-US").format(n || 0);

function fmtDurationMs(ms) {
  const totalMinutes = Math.round((Number(ms) || 0) / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtCompact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function fmtAxis(v) {
  if (v >= 1_000_000) {
    const s = (v / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${s}M`;
  }
  if (v >= 10_000) {
    const s = (v / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${s}k`;
  }
  return String(Math.round(v));
}

function niceCeiling(max) {
  if (!max || max <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const nice = steps.find((s) => n <= s) || 10;
  return nice * pow;
}

function providerName(providerId) {
  return AI_PROVIDERS[providerId]?.name || providerId || "—";
}

function latencyOf(detail) {
  const l = detail?.latency;
  if (typeof l === "number") return l;
  if (l && typeof l === "object") {
    if (typeof l.total === "number") return l.total;
    if (typeof l.totalMs === "number") return l.totalMs;
  }
  return null;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

const thClass =
  "text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap";
const thNumClass = `${thClass} text-right font-mono text-[12.5px]`;
const tdClass = "px-3.5 py-2.5 border-b border-border align-middle";
const tdNumClass = `${tdClass} text-right font-mono text-[12.5px]`;

export default function UsagePage() {
  // Restored tab switch: "overview" renders the spec content exactly as
  // before; "logger" swaps in the Request Logger view.
  const [view, setView] = useState("overview");
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState([]);
  const [chartMode, setChartMode] = useState("requests");
  // null = not loaded / failed (render "—"); { total, errors } once loaded.
  const [successData, setSuccessData] = useState(null);
  // providerId -> { errors: number|null, avgLatency: number|null }
  const [providerDetails, setProviderDetails] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/usage/stats?period=7d").then((data) => {
      if (!cancelled && data) setStats(data);
    });
    fetchJson("/api/usage/chart?period=7d").then((data) => {
      if (!cancelled && Array.isArray(data)) setChart(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startDate = useMemo(
    () => new Date(Date.now() - 7 * 86400000).toISOString(),
    []
  );

  // Success rate from the request-details totals (U-03 B-part).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = `/api/usage/request-details?pageSize=1&startDate=${encodeURIComponent(startDate)}`;
      const [totalRes, errorRes] = await Promise.all([
        fetchJson(base),
        fetchJson(`${base}&status=error`),
      ]);
      if (cancelled) return;
      const total = totalRes?.pagination?.totalItems;
      const errors = errorRes?.pagination?.totalItems;
      if (typeof total === "number" && typeof errors === "number") {
        setSuccessData({ total, errors });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate]);

  const modelRows = useMemo(() => {
    const entries = Object.values(stats?.byModel || {});
    return entries
      .map((m) => ({
        model: m.rawModel || "—",
        requests: m.requests || 0,
        tokens: (m.promptTokens || 0) + (m.completionTokens || 0),
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 6);
  }, [stats]);

  const providerRows = useMemo(() => {
    const entries = Object.entries(stats?.byProvider || {});
    return entries
      .map(([id, p]) => ({ id, requests: p.requests || 0 }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);
  }, [stats]);

  // Per-provider errors + avg latency from request-details (U-06).
  useEffect(() => {
    if (providerRows.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        providerRows.map(async (row) => {
          const base = `/api/usage/request-details?provider=${encodeURIComponent(row.id)}&startDate=${encodeURIComponent(startDate)}`;
          const [errRes, sampleRes] = await Promise.all([
            fetchJson(`${base}&status=error&pageSize=1`),
            fetchJson(`${base}&pageSize=100`),
          ]);
          const errors =
            typeof errRes?.pagination?.totalItems === "number"
              ? errRes.pagination.totalItems
              : null;
          let avgLatency = null;
          const details = sampleRes?.details;
          if (Array.isArray(details) && details.length > 0) {
            const vals = details.map(latencyOf).filter((v) => v != null);
            if (vals.length > 0) {
              avgLatency = vals.reduce((a, b) => a + b, 0) / vals.length;
            }
          }
          return [row.id, { errors, avgLatency }];
        })
      );
      if (!cancelled) setProviderDetails(Object.fromEntries(results));
    })();
    return () => {
      cancelled = true;
    };
  }, [providerRows, startDate]);

  const totalRequests = stats?.totalRequests || 0;

  const successRate =
    successData && successData.total > 0
      ? `${(((successData.total - successData.errors) / successData.total) * 100).toFixed(1)}%`
      : "—";

  // Chart geometry (artifact: viewBox 0 0 720 210, baseline y=170,
  // plot height 150, bars x=70+i*92 w=46 rx=3).
  const series = chart.map((d) =>
    chartMode === "tokens" ? d.tokens || 0 : d.requests || 0
  );
  const ceiling = niceCeiling(Math.max(0, ...series));
  const dayLabel = (i) => {
    const d = new Date();
    d.setDate(d.getDate() - (chart.length - 1 - i));
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    return `${weekday} ${d.getDate()}`;
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Usage</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">
          Every request through the router, by model and provider. Last 7 days shown; totals are all-time for this machine.
        </p>
      </div>

      {/* Restored tab switch (batch 3): Overview keeps the spec
          single-scroll content; Request Logger is the added view. */}
      <div className="mb-3.5">
        <SegmentedControl
          options={[
            { value: "overview", label: "Overview" },
            { value: "logger", label: "Request Logger" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {view === "logger" ? (
        <div className="flex flex-col gap-6">
          <RequestLogger />
          {/* Request Details (U-07): filterable request-details table;
              each row's Detail action opens the Request Details modal. */}
          <RequestDetailsTab />
        </div>
      ) : (
      <div className="flex flex-col gap-3.5">
        {/* Stat cards */}
        <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-4">
          <Card>
            <div className="text-xs font-medium text-text-muted mb-2">Requests (7d)</div>
            <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">
              {stats ? fmt(totalRequests) : "—"}
            </div>
            {stats && stats.requestsDeltaPct != null ? (
              <div className="text-xs text-text-muted mt-[7px]">
                <b className="font-mono font-semibold text-text-main">
                  {stats.requestsDeltaPct > 0 ? "+" : ""}
                  {stats.requestsDeltaPct}%
                </b>{" "}
                vs previous week
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="text-xs font-medium text-text-muted mb-2">Tokens in / out (7d)</div>
            <div className="font-mono text-[21px] pt-[5px] font-semibold tracking-[-0.02em] leading-[1.1]">
              {stats
                ? `${fmtCompact(stats.totalPromptTokens)} / ${fmtCompact(stats.totalCompletionTokens)}`
                : "—"}
            </div>
            <div className="text-xs text-text-muted mt-[7px]">Across all providers</div>
          </Card>

          <Card>
            <div className="text-xs font-medium text-text-muted mb-2">Time saved by fallback</div>
            <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">
              {stats?.fallback ? fmtDurationMs(stats.fallback.timeSavedMs) : "—"}
            </div>
            {stats?.fallback ? (
              <div className="text-xs text-text-muted mt-[7px]">
                <b className="font-mono font-semibold text-text-main">{fmt(stats.fallback.recovered)}</b>{" "}
                recovered · {fmt(stats.fallback.events)} fallback events
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="text-xs font-medium text-text-muted mb-2">Success rate</div>
            <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">
              {successRate}
            </div>
            {successData && successData.total > 0 ? (
              <div className="text-xs text-text-muted mt-[7px]">
                <b className="font-mono font-semibold text-text-main">{fmt(successData.errors)}</b>{" "}
                errors
                {stats?.fallback ? (
                  <>
                    {" "}· {fmt(stats.fallback.recovered)} recovered by fallback
                  </>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>

        {/* Requests per day chart */}
        <Card padding="none">
          <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
            <h3 className="text-[13.5px] font-semibold">Requests per day</h3>
            <div className="flex-1" />
            <SegmentedControl
              options={[
                { value: "requests", label: "Requests" },
                { value: "tokens", label: "Tokens" },
              ]}
              value={chartMode}
              onChange={setChartMode}
            />
          </div>
          <div className="px-[22px] pt-5 pb-3.5">
            <svg
              viewBox="0 0 720 210"
              width="100%"
              role="img"
              aria-label="Bar chart of requests per day"
              style={{ display: "block" }}
            >
              <g stroke="var(--color-border)" strokeWidth="1">
                <line x1="44" y1="20" x2="700" y2="20" />
                <line x1="44" y1="70" x2="700" y2="70" />
                <line x1="44" y1="120" x2="700" y2="120" />
                <line x1="44" y1="170" x2="700" y2="170" />
              </g>
              <g
                fontFamily="IBM Plex Mono, monospace"
                fontSize="10.5"
                fill="var(--color-text-subtle)"
                textAnchor="end"
              >
                <text x="36" y="24">{fmtAxis(ceiling)}</text>
                <text x="36" y="74">{fmtAxis((ceiling * 2) / 3)}</text>
                <text x="36" y="124">{fmtAxis(ceiling / 3)}</text>
                <text x="36" y="174">0</text>
              </g>
              <g fill="var(--color-brand-500)">
                {series.map((value, i) => {
                  const h = ceiling > 0 ? (value / ceiling) * 150 : 0;
                  return (
                    <rect
                      key={i}
                      x={70 + i * 92}
                      y={170 - h}
                      width="46"
                      height={h}
                      rx="3"
                    />
                  );
                })}
              </g>
              <g
                fontFamily="IBM Plex Mono, monospace"
                fontSize="11"
                fill="var(--color-text-muted)"
                textAnchor="middle"
              >
                {series.map((value, i) => {
                  const h = ceiling > 0 ? (value / ceiling) * 150 : 0;
                  return (
                    <text key={i} x={70 + i * 92 + 23} y={170 - h - 6}>
                      {chartMode === "tokens" ? fmtCompact(value) : fmt(value)}
                    </text>
                  );
                })}
              </g>
              <g
                fontFamily="IBM Plex Mono, monospace"
                fontSize="10.5"
                fill="var(--color-text-subtle)"
                textAnchor="middle"
              >
                {chart.map((_, i) => (
                  <text key={i} x={70 + i * 92 + 23} y="192">
                    {dayLabel(i)}
                  </text>
                ))}
              </g>
            </svg>
          </div>
        </Card>

        {/* By model / By provider */}
        <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2">
          <Card padding="none">
            <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
              <h3 className="text-[13.5px] font-semibold">By model</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
                <thead>
                  <tr>
                    <th className={thClass}>Model</th>
                    <th className={thNumClass}>Requests</th>
                    <th className={thNumClass}>Tokens</th>
                    <th className={thNumClass}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {modelRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`${tdClass} text-xs text-text-muted`}>
                        No usage recorded in the last 7 days
                      </td>
                    </tr>
                  ) : (
                    modelRows.map((row) => (
                      <tr key={row.model}>
                        <td className={`${tdClass} font-mono text-[12.5px]`}>{row.model}</td>
                        <td className={tdNumClass}>{fmt(row.requests)}</td>
                        <td className={tdNumClass}>{fmtCompact(row.tokens)}</td>
                        <td className={tdNumClass}>
                          {totalRequests > 0
                            ? `${Math.round((row.requests / totalRequests) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padding="none">
            <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
              <h3 className="text-[13.5px] font-semibold">By provider</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
                <thead>
                  <tr>
                    <th className={thClass}>Provider</th>
                    <th className={thNumClass}>Requests</th>
                    <th className={thNumClass}>Errors</th>
                    <th className={thNumClass}>Avg latency</th>
                  </tr>
                </thead>
                <tbody>
                  {providerRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`${tdClass} text-xs text-text-muted`}>
                        No usage recorded in the last 7 days
                      </td>
                    </tr>
                  ) : (
                    providerRows.map((row) => {
                      const detail = providerDetails[row.id];
                      return (
                        <tr key={row.id}>
                          <td className={tdClass}>{providerName(row.id)}</td>
                          <td className={tdNumClass}>{fmt(row.requests)}</td>
                          <td className={tdNumClass}>
                            {detail && detail.errors != null ? fmt(detail.errors) : "—"}
                          </td>
                          <td className={tdNumClass}>
                            {detail && detail.avgLatency != null
                              ? `${fmt(Math.round(detail.avgLatency))} ms`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Restored extra (U-05): ProviderTopology graph as an
            additional section under the spec content. */}
        <TopologySection />
      </div>
      )}
    </div>
  );
}
