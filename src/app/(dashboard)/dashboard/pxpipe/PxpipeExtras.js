"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, Button } from "@/shared/components";
import { useTheme } from "@/shared/hooks/useTheme";

// Option-2 restoration (batch 4): the PXPIPE savings chart + History +
// Logs sections dropped in Phase 2 (PX-08 / audit §II.24), restored as
// ADDITIONAL cards below the spec status/KV/stat cards and the Phase-4
// stage-configuration form. Data comes from the same endpoints the
// pre-removal sections used: GET /api/pxpipe/stats (windows / timeline
// / recent) and GET /api/pxpipe/logs (installLog). Chart ink follows
// the active theme (the pre-removal chart hardcoded the light ink,
// which was illegible on the dark surface).

const fmtTokens = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
};

const WINDOW_TABS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7d", label: "7 days" },
  { id: "last30d", label: "30 days" },
  { id: "all", label: "All time" },
];

const REASON_LABELS = {
  applied: "Prompt exceeded threshold",
  below_threshold: "Below size threshold",
  not_profitable: "Compression not profitable",
  below_min_chars: "Below minimum chars",
  below_min_tokens: "Below minimum tokens",
  unsupported_model: "Model not in allowlist",
  unsupported_format: "Non-Claude request format",
  timeout: "Compression timed out",
  transform_error: "Transform error",
  passthrough: "Passthrough",
  disabled: "Disabled",
  not_installed: "Not installed",
};

const thClass =
  "text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3 py-2 border-b border-border whitespace-nowrap";
const thNumClass = `${thClass} text-right`;
const tdClass = "px-3 py-1.5 border-b border-border align-middle text-[12.5px]";
const tdNumClass = `${tdClass} text-right font-mono text-xs`;

export default function PxpipeExtras() {
  const { isDark } = useTheme();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState(null);
  const [windowId, setWindowId] = useState("last7d");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch("/api/pxpipe/stats"),
        fetch("/api/pxpipe/logs?limit=50"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch {
      /* sections render placeholders */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const w = stats?.windows?.[windowId];
  const chartColor = isDark ? "#f2f3f4" : "#101418";

  return (
    <>
      {/* Token savings (estimated) + chart */}
      <Card className="mt-3.5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-[13.5px] font-semibold">Token savings (estimated)</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
              {WINDOW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setWindowId(tab.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    windowId === tab.id
                      ? "bg-brand-500 text-on-brand"
                      : "text-text-muted hover:text-text-main hover:bg-surface-3"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={refresh} loading={loading}>
              Refresh
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-text-muted">Original tokens</p>
            <p className="text-lg font-semibold">{w ? fmtTokens(w.tokensBeforeEst) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">After PXPIPE</p>
            <p className="text-lg font-semibold">{w ? fmtTokens(w.tokensAfterEst) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Saved</p>
            <p className="text-lg font-semibold">{w ? fmtTokens(w.tokensSavedEst) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Reduction</p>
            <p className="text-lg font-semibold">{w ? `${w.savedPct}%` : "—"}</p>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-3">
          Estimates from body size before/after imaging; billed usage per request
          (recorded on the Usage page) remains the ground truth. Images generated:{" "}
          {w ? w.imagesGenerated.toLocaleString() : "—"} · avg compression time:{" "}
          {w ? `${w.avgCompressionMs}ms` : "—"} · errors: {w ? w.errors : "—"}
        </p>

        <h4 className="text-[13px] font-semibold mt-5 mb-3">Tokens saved — last 30 days</h4>
        {stats?.timeline?.some((d) => d.tokensSavedEst > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.timeline} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPxpipeRestored" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.55 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.55 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtTokens}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v) => [fmtTokens(v), "Tokens saved"]}
                labelFormatter={(d) => d}
              />
              <Area
                type="monotone"
                dataKey="tokensSavedEst"
                stroke={chartColor}
                fill="url(#gradPxpipeRestored)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-32 flex items-center justify-center text-text-muted text-sm">
            No savings recorded yet — enable PXPIPE and route a large Claude-format request.
          </div>
        )}
      </Card>

      {/* History */}
      <Card padding="none" className="mt-3.5">
        <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
          <h3 className="text-[13.5px] font-semibold">History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th className={thClass}>Time</th>
                <th className={thClass}>Model</th>
                <th className={thNumClass}>Original</th>
                <th className={thNumClass}>Compressed</th>
                <th className={thNumClass}>Saved</th>
                <th className={thNumClass}>%</th>
                <th className={thNumClass}>Duration</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recent || []).slice(0, 50).map((ev, i) => (
                <tr key={`${ev.ts}-${i}`}>
                  <td className={`${tdClass} whitespace-nowrap text-text-muted`}>
                    {new Date(ev.ts).toLocaleString()}
                  </td>
                  <td className={`${tdClass} font-mono text-xs`}>
                    {ev.provider ? `${ev.provider}/${ev.model}` : ev.model || "—"}
                  </td>
                  <td className={tdNumClass}>{ev.applied ? fmtTokens(ev.tokensBeforeEst) : "—"}</td>
                  <td className={tdNumClass}>{ev.applied ? fmtTokens(ev.tokensAfterEst) : "—"}</td>
                  <td className={tdNumClass}>{ev.applied ? fmtTokens(ev.tokensSavedEst) : "—"}</td>
                  <td className={tdNumClass}>{ev.applied ? `${ev.savedPct}%` : "—"}</td>
                  <td className={tdNumClass}>{ev.durationMs != null ? `${ev.durationMs}ms` : "—"}</td>
                  <td className={tdClass}>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${
                        ev.applied
                          ? "border-border-strong bg-surface-2 text-text-main"
                          : ev.reason === "transform_error" || ev.reason === "timeout"
                            ? "border-border-strong text-danger"
                            : "border-border text-text-muted"
                      }`}
                      title={ev.detail || ""}
                    >
                      {ev.applied ? "Compressed" : REASON_LABELS[ev.reason] || ev.reason}
                    </span>
                  </td>
                </tr>
              ))}
              {(!stats?.recent || stats.recent.length === 0) && (
                <tr>
                  <td colSpan={8} className={`${tdClass} py-6 text-center text-text-muted text-sm`}>
                    No PXPIPE activity yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Logs */}
      <Card className="mt-3.5" >
        <div id="logs">
          <h3 className="text-[13.5px] font-semibold mb-3">PXPIPE Logs</h3>
          {logs?.installLog ? (
            <pre className="rounded bg-black/5 dark:bg-white/5 p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
              {logs.installLog}
            </pre>
          ) : (
            <p className="text-sm text-text-muted">No install log yet.</p>
          )}
        </div>
      </Card>
    </>
  );
}
