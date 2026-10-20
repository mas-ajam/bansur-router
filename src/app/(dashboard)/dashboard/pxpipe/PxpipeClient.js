"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, Badge, Toggle } from "@/shared/components";
import useSettingsStore from "@/store/settingsStore";

// Phase-2 parity (audit PX-01..PX-03): artifact head, one status card
// (setting-row + KV) and the four spec stat cards. The token-savings
// chart, History table and PXPIPE Logs card are removed per PX-08 /
// §II.24; the underlying /api/pxpipe/* endpoints are untouched.
// PX-07 (Stage configuration) is class C / Phase 4 — not built here.

function KvRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px] last:border-b-0">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-[12.5px] text-right">{value}</span>
    </div>
  );
}

function StatCard({ label, value, delta }) {
  return (
    <Card>
      <div className="text-xs font-medium text-text-muted mb-2">{label}</div>
      <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">{value}</div>
      <div className="text-xs text-text-muted mt-[7px]">{delta}</div>
    </Card>
  );
}

// p50 over the per-event durationMs carried by stats.recent[] (PX-04:
// computed client-side from the real event window, no server aggregate).
function computeP50(recent) {
  if (!Array.isArray(recent) || recent.length === 0) return null;
  const durations = recent
    .map((ev) => ev?.durationMs)
    .filter((n) => typeof n === "number" && Number.isFinite(n))
    .sort((a, b) => a - b);
  if (durations.length === 0) return null;
  const mid = Math.floor(durations.length / 2);
  const p50 =
    durations.length % 2 === 0
      ? (durations[mid - 1] + durations[mid]) / 2
      : durations[mid];
  return Math.round(p50);
}

export default function PxpipeClient() {
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [origin, setOrigin] = useState("");
  const [toggling, setToggling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, statsRes] = await Promise.all([
        fetch("/api/pxpipe/status", { headers: { "Cache-Control": "no-store" } }),
        fetch("/api/pxpipe/stats"),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      /* sections render placeholders */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // The pipeline enable/disable switch is the pxpipeEnabled setting —
  // the same call the Token Saver PXPIPE section uses.
  const handleToggleEnabled = async (value) => {
    if (!status) return;
    setToggling(true);
    setStatus((prev) => (prev ? { ...prev, enabled: value } : prev));
    try {
      const updated = await useSettingsStore.getState().patchSettings({ pxpipeEnabled: value });
      if (!updated) await refresh();
    } finally {
      setToggling(false);
    }
  };

  const running = status?.running === true;
  const enabled = status?.enabled === true;
  const installed = status?.installed === true;

  const statusDesc = !status
    ? "Checking stage status…"
    : !installed
      ? "Stage is not installed."
      : running
        ? "Stage is running and in the request path for enabled routes."
        : enabled
          ? "Stage is enabled but not currently running."
          : "Stage is stopped.";

  const requestsProcessed = stats?.windows?.all?.requests;
  const p50 = useMemo(() => computeP50(stats?.recent), [stats]);
  const stageErrors = useMemo(() => {
    const aggregate = stats?.windows?.all?.errors;
    if (typeof aggregate === "number") return aggregate;
    if (!Array.isArray(stats?.recent)) return null;
    return stats.recent.filter(
      (ev) => ev?.reason === "transform_error" || ev?.reason === "timeout",
    ).length;
  }, [stats]);

  return (
    <div className="flex flex-col">
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">PXPIPE</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Optional proxy pipeline stage that requests can pass through before reaching a provider.</p>
      </div>

      {/* Status card */}
      <Card>
        <div className="flex items-center gap-3.5 pt-[2px] pb-[13px] border-b border-border">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${
              running ? "bg-brand-500" : "bg-transparent border-[1.5px] border-[#a7afb6]"
            }`}
          />
          <div className="grow">
            <b className="block text-[13.5px] font-semibold">PXPIPE pipeline</b>
            <span className="text-[12.5px] text-text-muted">{statusDesc}</span>
          </div>
          <Badge variant={running ? "primary" : "default"}>{running ? "Running" : "Stopped"}</Badge>
          <Toggle
            checked={enabled}
            disabled={!status || !installed || toggling}
            onChange={handleToggleEnabled}
          />
        </div>
        <div>
          <KvRow label="Pipeline endpoint" value={origin ? `${origin}/pxpipe` : "—"} />
          <KvRow label="Applied to" value={enabled ? "All /v1 routes" : "—"} />
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-4 mt-3.5">
        <StatCard
          label="Requests processed"
          value={typeof requestsProcessed === "number" ? requestsProcessed.toLocaleString() : "—"}
          delta="Since router start"
        />
        <StatCard
          label="Added latency (p50)"
          value={p50 !== null ? `${p50} ms` : "—"}
          delta="Per request through the stage"
        />
        <StatCard label="Cache hit rate" value="—" delta="Repeated identical requests" />
        <StatCard
          label="Stage errors"
          value={stageErrors !== null && stageErrors !== undefined ? Number(stageErrors).toLocaleString() : "—"}
          delta="Fails open to direct routing"
        />
      </div>
    </div>
  );
}
