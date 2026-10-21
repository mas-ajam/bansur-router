"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, Badge, Toggle, Button, Input } from "@/shared/components";
import useSettingsStore from "@/store/settingsStore";
import { useNotificationStore } from "@/store/notificationStore";
import PxpipeExtras from "./PxpipeExtras";

// Phase-2 parity (audit PX-01..PX-03): artifact head, one status card
// (setting-row + KV) and the four spec stat cards. Option-2 restoration
// (batch 4): the token-savings chart, History table and PXPIPE Logs
// return as additions in PxpipeExtras.js, over the same untouched
// /api/pxpipe/* endpoints.
// Phase 4c (PX-02/04/05/07): "Applied to" + cache stats come from the
// server payloads, and the Stage configuration form below writes the
// pxpipeCacheTtlSec / pxpipeMaxPayloadMb settings the loader cache reads.

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

// Fallback p50 over the per-event durationMs carried by stats.recent[],
// used only when the server aggregate (stats.p50DurationMs, computed over
// ALL events in the window) is absent.
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
  const notify = useNotificationStore();
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [origin, setOrigin] = useState("");
  const [toggling, setToggling] = useState(false);
  const [cacheTtlSec, setCacheTtlSec] = useState("");
  const [maxPayloadMb, setMaxPayloadMb] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, statsRes, settingsRes] = await Promise.all([
        fetch("/api/pxpipe/status", { headers: { "Cache-Control": "no-store" } }),
        fetch("/api/pxpipe/stats"),
        fetch("/api/settings", { headers: { "Cache-Control": "no-store" } }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.pxpipeCacheTtlSec !== undefined) setCacheTtlSec(String(settings.pxpipeCacheTtlSec));
        if (settings.pxpipeMaxPayloadMb !== undefined) setMaxPayloadMb(String(settings.pxpipeMaxPayloadMb));
      }
    } catch {
      /* sections render placeholders */
    }
  }, []);

  const handleSaveConfig = async () => {
    const ttl = Number(cacheTtlSec);
    const maxMb = Number(maxPayloadMb);
    if (!Number.isFinite(ttl) || ttl < 0 || !Number.isFinite(maxMb) || maxMb < 0) {
      notify.error("Cache TTL and Max payload must be numbers ≥ 0");
      return;
    }
    setSavingConfig(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pxpipeCacheTtlSec: ttl, pxpipeMaxPayloadMb: maxMb }),
      });
      if (!res.ok) throw new Error("Save failed");
      notify.success("PXPIPE settings saved");
    } catch {
      notify.error("Failed to save PXPIPE settings");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleFlushCache = async () => {
    setFlushing(true);
    try {
      const res = await fetch("/api/pxpipe/cache/flush", { method: "POST" });
      if (!res.ok) throw new Error("Flush failed");
      notify.success("Pipeline cache cleared");
      await refresh();
    } catch {
      notify.error("Failed to flush the pipeline cache");
    } finally {
      setFlushing(false);
    }
  };

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
  const p50 = useMemo(() => {
    if (typeof stats?.p50DurationMs === "number") return stats.p50DurationMs;
    return computeP50(stats?.recent);
  }, [stats]);
  const cacheHitRate = typeof stats?.cacheHitRate === "number" ? stats.cacheHitRate : null;
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
          <KvRow label="Applied to" value={status?.appliedTo || "—"} />
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
        <StatCard
          label="Cache hit rate"
          value={cacheHitRate !== null ? `${(cacheHitRate * 100).toFixed(1)}%` : "—"}
          delta="Repeated identical requests"
        />
        <StatCard
          label="Stage errors"
          value={stageErrors !== null && stageErrors !== undefined ? Number(stageErrors).toLocaleString() : "—"}
          delta="Fails open to direct routing"
        />
      </div>

      {/* Stage configuration (PX-07) */}
      <Card className="mt-3.5">
        <h3 className="text-[13.5px] font-semibold mb-3.5">Stage configuration</h3>
        <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2">
          <Input
            label="Cache TTL (seconds)"
            type="number"
            min="0"
            value={cacheTtlSec}
            onChange={(e) => setCacheTtlSec(e.target.value)}
            inputClassName="font-mono"
          />
          <Input
            label="Max payload (MB)"
            type="number"
            min="0"
            value={maxPayloadMb}
            onChange={(e) => setMaxPayloadMb(e.target.value)}
            inputClassName="font-mono"
          />
        </div>
        <div className="flex items-center gap-2 mt-3.5">
          <Button variant="primary" onClick={handleSaveConfig} loading={savingConfig}>
            Save
          </Button>
          <Button variant="secondary" onClick={handleFlushCache} loading={flushing}>
            Flush cache
          </Button>
        </div>
      </Card>

      {/* Restored extras (Option 2 batch 4): savings chart, History and
          Logs as additions below the spec cards. */}
      <PxpipeExtras />
    </div>
  );
}
