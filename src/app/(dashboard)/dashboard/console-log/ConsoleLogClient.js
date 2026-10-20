"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Card, Button, Badge } from "@/shared/components";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { cn } from "@/shared/utils/cn";

// Phase 3 — Console Log rebuild (audit §II.14, CL-01..CL-05).
// The black SSE text terminal (/api/translator/console-logs/stream)
// is replaced by the artifact's light request table, built on the
// structured request-details store (GET /api/usage/request-details,
// polled every ~5s unless paused).
// Stored shapes (requestDetailsRepo / chatCore buildRequestDetail):
//   status: "success" | "error" (exact-match filter — &status= works)
//   latency: { ttft, total } (ms)   tokens: { prompt_tokens, completion_tokens }
//   timestamp: ISO string with millisecond precision (CL-05 ✓)
// Class-C flags: CL-02-C tool field does not exist (Tool column "—",
// tools filter rendered disabled with only "All tools"; the artifact's
// "Fallback" status option is omitted — no fallback field to match);
// CL-03 detail row shows only real stored fields (combo step,
// quota-check %, RTK-saved are Phase 4). Status codes render only
// when a payload carries a numeric code — neither store does (the
// numeric upstream code lives in the redacted `response` field).

const fmt = (n) => new Intl.NumberFormat("en-US").format(n || 0);

function providerName(providerId) {
  return AI_PROVIDERS[providerId]?.name || providerId || "—";
}

function parseStatus(status) {
  if (status == null || status === "") return { isError: false, code: null };
  if (typeof status === "number") return { isError: status >= 400, code: status };
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

function formatTimeMs(timestamp) {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) return "—";
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function latencyMs(detail) {
  const l = detail?.latency;
  if (typeof l === "number") return l;
  if (l && typeof l === "object") {
    if (typeof l.total === "number") return l.total;
    if (typeof l.totalMs === "number") return l.totalMs;
  }
  if (typeof detail?.latencyMs === "number") return detail.latencyMs;
  return null;
}

function tokensIn(detail) {
  const t = detail?.tokens || {};
  return t.prompt_tokens ?? t.input_tokens ?? detail?.promptTokens ?? detail?.inputTokens ?? 0;
}

function tokensOut(detail) {
  const t = detail?.tokens || {};
  return (
    t.completion_tokens ?? t.output_tokens ?? detail?.completionTokens ?? detail?.outputTokens ?? 0
  );
}

function Chevron() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// .field-styled select (same classes as the shared Select primitive's
// inner element) — the shared Select's disabled placeholder option
// cannot represent a re-selectable "All …" filter value.
function FilterSelect({ value, onChange, options, disabled = false, className }) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          "w-full py-2 pl-[11px] pr-7 text-sm text-text-main",
          "bg-surface border border-border-strong rounded-md appearance-none",
          "focus:outline-none focus:border-brand-500 focus:shadow-[var(--shadow-focus)]",
          "transition-[border-color,box-shadow] duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-[10px] pointer-events-none text-text-muted">
        <Chevron />
      </div>
    </div>
  );
}

const thClass =
  "text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap";
const thNumClass = `${thClass} text-right font-mono text-[12.5px]`;
const tdClass = "px-3.5 py-2.5 border-b border-border align-middle";
const tdNumClass = `${tdClass} text-right font-mono text-[12.5px]`;

export default function ConsoleLogClient() {
  const [rows, setRows] = useState([]);
  const [paused, setPaused] = useState(false);
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerIds, setProviderIds] = useState([]);
  const [connectionLabels, setConnectionLabels] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  // connectionId -> account label (fetched once).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const map = {};
        for (const c of data.connections || []) {
          const label = c.name?.trim() || c.email?.trim() || c.displayName?.trim() || null;
          if (c.id && label) map[c.id] = label;
        }
        setConnectionLabels(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchRows = useCallback(async () => {
    try {
      const params = new URLSearchParams({ pageSize: "25" });
      if (providerFilter) params.set("provider", providerFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/usage/request-details?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const details = data.details || [];
      setRows(details);
      setProviderIds((prev) => {
        const set = new Set(prev);
        let changed = false;
        for (const d of details) {
          if (d.provider && !set.has(d.provider)) {
            set.add(d.provider);
            changed = true;
          }
        }
        return changed ? [...set] : prev;
      });
    } catch {
      // Keep the last good rows on a failed poll.
    }
  }, [providerFilter, statusFilter]);

  useEffect(() => {
    fetchRows();
    if (paused) return undefined;
    const timer = setInterval(fetchRows, 5000);
    return () => clearInterval(timer);
  }, [fetchRows, paused]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "console-log.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const detailString = (d) => {
    const parts = [];
    if (d.id) parts.push(`request id ${d.id}`);
    if (d.provider) parts.push(`provider ${d.provider}`);
    const account = d.connectionId ? connectionLabels[d.connectionId] : null;
    if (account) parts.push(`account ${account}`);
    if (d.status) parts.push(`status ${d.status}`);
    const lat = latencyMs(d);
    if (lat != null) parts.push(`latency ${lat} ms`);
    parts.push(`tokens ${fmt(tokensIn(d))} in / ${fmt(tokensOut(d))} out`);
    if (d.timestamp) parts.push(new Date(d.timestamp).toISOString());
    return parts.join(" · ");
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Console Log</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">
          Live request log from the router. Select a row to inspect the routing decision.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
        {paused ? (
          <Badge>Paused</Badge>
        ) : (
          <Badge variant="primary">
            <span className="inline-block w-2 h-2 rounded-full bg-white shrink-0" />
            Streaming
          </Badge>
        )}
        <FilterSelect
          className="w-full max-w-[170px]"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          options={[
            { value: "", label: "All providers" },
            ...providerIds.map((id) => ({ value: id, label: providerName(id) })),
          ]}
        />
        <FilterSelect
          className="w-full max-w-[150px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: "", label: "Any status" },
            { value: "success", label: "OK" },
            { value: "error", label: "ERROR" },
          ]}
        />
        {/* CL-02-C: no tool field exists in the payload — honest disabled placeholder. */}
        <FilterSelect
          className="w-full max-w-[170px]"
          value=""
          onChange={() => {}}
          disabled
          options={[{ value: "", label: "All tools" }]}
        />
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => setPaused((p) => !p)}>
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleExport}>
          Export
        </Button>
      </div>

      {/* Request table */}
      <Card padding="none">
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
                <th className={thNumClass}>Tokens in</th>
                <th className={thNumClass}>Tokens out</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`${tdClass} text-xs text-text-muted`}>
                    No requests recorded yet
                  </td>
                </tr>
              ) : (
                rows.map((d, i) => {
                  const rowKey = d.id || `${d.timestamp || ""}-${i}`;
                  const account = d.connectionId ? connectionLabels[d.connectionId] : null;
                  const lat = latencyMs(d);
                  const expanded = expandedId === rowKey;
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className="cursor-pointer hover:bg-surface-2"
                        onClick={() => setExpandedId(expanded ? null : rowKey)}
                      >
                        <td className={`${tdClass} font-mono text-[12.5px]`}>
                          {formatTimeMs(d.timestamp)}
                        </td>
                        <td className={tdClass}>—</td>
                        <td className={`${tdClass} font-mono text-[12.5px]`}>{d.model || "—"}</td>
                        <td className={tdClass}>
                          {providerName(d.provider)}
                          {account ? ` · ${account}` : ""}
                        </td>
                        <td className={tdClass}>
                          <StatusCell status={d.status} />
                        </td>
                        <td className={tdNumClass}>{lat != null ? fmt(lat) : "—"}</td>
                        <td className={tdNumClass}>{fmt(tokensIn(d))}</td>
                        <td className={tdNumClass}>{fmt(tokensOut(d))}</td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-3.5 py-2.5 border-b border-border align-middle bg-surface-2 font-mono text-xs text-text-muted whitespace-pre-wrap break-words"
                          >
                            {detailString(d)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
