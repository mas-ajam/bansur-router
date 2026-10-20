"use client";

import { useState, useEffect } from "react";
import { Card, Button, Toggle, Input, Select, Badge } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

/* Settings screen (Phase 3 split from Profile, audit SE-03..SE-07).
   Controls hold local state and are batch-saved with one PATCH /api/settings
   (SE-07), reusing the exact keys the old Profile cards saved instantly:
   requireLogin, enableObservability, outboundProxyEnabled/Url/NoProxy,
   fallbackStrategy + stickyRoundRobinLimit. */

const PRICING_ROWS = [
  ["Claude Code · Pro / Max", "Subscription", "Plan-based"],
  ["Codex · Plus", "Subscription", "Plan-based"],
  ["GitHub Copilot · Pro", "Subscription", "300 premium req/mo"],
  ["GLM (Zhipu)", "API key", "$0.6 / 1M tokens"],
  ["MiniMax", "API key", "$0.20 / 1M tokens"],
  ["Kimi (Moonshot)", "API key", "Per provider pricing"],
  ["DeepSeek", "API key", "Per provider pricing"],
  ["Kiro AI", "Credits", "500 free credits/mo"],
  ["Vertex AI", "Trial credit", "$300 trial credit"],
];

const LOG_LEVEL_OPTIONS = [
  { value: "info", label: "info" },
  { value: "debug", label: "debug" },
  { value: "warn", label: "warn" },
  { value: "error", label: "error" },
];

const ROUTING_OPTIONS = [
  { value: "roundrobin", label: "Round Robin" },
  { value: "sticky", label: "Sticky (per session)" },
  { value: "quota", label: "Most quota remaining" },
];

function deriveRouting(settings) {
  if (settings.fallbackStrategy === "round-robin") {
    return (settings.stickyRoundRobinLimit || 3) > 1 ? "sticky" : "roundrobin";
  }
  // "fill-first" (the app default) has no artifact counterpart; the select
  // shows Round Robin and saving applies it. Flagged SE-04 partial.
  return "roundrobin";
}

function deriveProxyChoice(settings, pools) {
  if (settings.outboundProxyEnabled !== true) return "none";
  const url = settings.outboundProxyUrl || "";
  const match = pools.find((p) => p.proxyUrl && p.proxyUrl === url);
  return match ? `pool:${match.id}` : "custom";
}

export default function SettingsPage() {
  const notify = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pools, setPools] = useState([]);

  const [port, setPort] = useState("667");
  const [logLevel, setLogLevel] = useState("info");
  const [requireLogin, setRequireLogin] = useState(true);
  const [observability, setObservability] = useState(false);
  const [localMode, setLocalMode] = useState(true);
  const [proxyChoice, setProxyChoice] = useState("none");
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyNoProxy, setProxyNoProxy] = useState("");
  const [routing, setRouting] = useState("roundrobin");
  const [stickyLimit, setStickyLimit] = useState(3);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.port) {
      setPort(window.location.port);
    }
    Promise.all([
      fetch("/api/settings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/proxy-pools", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([settings, poolsData]) => {
      const poolList = poolsData?.proxyPools || [];
      setPools(poolList);
      if (settings) {
        if (settings.port) setPort(String(settings.port));
        if (settings.logLevel) setLogLevel(settings.logLevel);
        setRequireLogin(settings.requireLogin !== false);
        setObservability(settings.enableObservability === true);
        setLocalMode(settings.localMode !== false);
        setProxyUrl(settings.outboundProxyUrl || "");
        setProxyNoProxy(settings.outboundNoProxy || "");
        setProxyChoice(deriveProxyChoice(settings, poolList));
        setRouting(deriveRouting(settings));
        setStickyLimit(settings.stickyRoundRobinLimit || 3);
      }
      setLoading(false);
    });
  }, []);

  const proxyOptions = [
    { value: "none", label: "No proxy (direct)" },
    ...pools.map((p) => ({ value: `pool:${p.id}`, label: `Pool: ${p.name}` })),
    { value: "custom", label: "Custom URL…" },
  ];

  const handleSave = async () => {
    const payload = {
      requireLogin,
      enableObservability: observability,
      localMode,
      logLevel,
    };
    const portNum = parseInt(port, 10);
    if (!Number.isNaN(portNum)) payload.port = portNum;

    if (proxyChoice === "none") {
      payload.outboundProxyEnabled = false;
    } else if (proxyChoice === "custom") {
      payload.outboundProxyEnabled = true;
      payload.outboundProxyUrl = proxyUrl.trim();
      payload.outboundNoProxy = proxyNoProxy;
    } else if (proxyChoice.startsWith("pool:")) {
      const pool = pools.find((p) => `pool:${p.id}` === proxyChoice);
      payload.outboundProxyEnabled = true;
      if (pool?.proxyUrl) payload.outboundProxyUrl = pool.proxyUrl;
    }

    // "Most quota remaining" has no backend strategy value (SE-04 partial):
    // it is left unsaved rather than mapped onto a different strategy.
    if (routing === "roundrobin") {
      payload.fallbackStrategy = "round-robin";
      payload.stickyRoundRobinLimit = 1;
    } else if (routing === "sticky") {
      payload.fallbackStrategy = "round-robin";
      payload.stickyRoundRobinLimit = stickyLimit || 3;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify.success("Settings saved");
      } else {
        notify.error(data.error || "Failed to save settings");
      }
    } catch {
      notify.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Settings</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Router behaviour for this machine, and the plan &amp; pricing reference for connected providers.</p>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2 items-start">
        {/* Router */}
        <Card>
          <h3 className="text-[13.5px] font-semibold mb-3.5">Router</h3>
          <div className="grid grid-cols-1 min-[821px]:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold mb-1.5">Port</label>
              <Input value={port} onChange={(e) => setPort(e.target.value)} inputClassName="font-mono" disabled={loading} />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold mb-1.5">Log level</label>
              <Select options={LOG_LEVEL_OPTIONS} value={logLevel} onChange={(e) => setLogLevel(e.target.value)} disabled={loading} />
            </div>
          </div>

          <div className="flex items-center gap-3.5 py-[13px] border-b border-border mt-[18px]">
            <div className="grow">
              <b className="block text-[13.5px] font-semibold">Require login</b>
              <span className="text-[12.5px] text-text-muted">Password-protect the dashboard</span>
            </div>
            <Toggle checked={requireLogin} onChange={setRequireLogin} disabled={loading} />
          </div>
          <div className="flex items-center gap-3.5 py-[13px] border-b border-border">
            <div className="grow">
              <b className="block text-[13.5px] font-semibold">Enable observability</b>
              <span className="text-[12.5px] text-text-muted">Record per-request traces for the Console Log</span>
            </div>
            <Toggle checked={observability} onChange={setObservability} disabled={loading} />
          </div>
          <div className="flex items-center gap-3.5 py-[13px] border-b border-border last:border-b-0">
            <div className="grow">
              <b className="block text-[13.5px] font-semibold">Local mode</b>
              <span className="text-[12.5px] text-text-muted">Never call out except to provider APIs</span>
            </div>
            <Toggle checked={localMode} onChange={setLocalMode} disabled={loading} />
          </div>

          <div className="mt-[18px]">
            <label className="block text-[12.5px] font-semibold mb-1.5">Outbound proxy</label>
            <Select options={proxyOptions} value={proxyChoice} onChange={(e) => setProxyChoice(e.target.value)} disabled={loading} />
          </div>
          {proxyChoice === "custom" && (
            <div className="mt-3.5">
              <label className="block text-[12.5px] font-semibold mb-1.5">Proxy URL</label>
              <Input
                placeholder="http://127.0.0.1:7897"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="mt-3.5">
            <label className="block text-[12.5px] font-semibold mb-1.5">Routing strategy (account rotation)</label>
            <Select options={ROUTING_OPTIONS} value={routing} onChange={(e) => setRouting(e.target.value)} disabled={loading} />
          </div>

          <div className="flex items-center gap-3.5 mt-[18px] flex-wrap">
            <Button variant="primary" onClick={handleSave} loading={saving} disabled={loading}>
              Save settings
            </Button>
            <span className="text-xs text-text-muted">Port changes apply after restart.</span>
          </div>
        </Card>

        {/* Pricing reference — static reference content defined by the artifact (SE-06) */}
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
            <h3 className="text-[13.5px] font-semibold grow">Pricing reference</h3>
            <Badge variant="default">Read-only</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap">Provider / plan</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap">Billing</th>
                  <th className="text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap">Reference price</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_ROWS.map(([plan, billing, price]) => (
                  <tr key={plan}>
                    <td className="px-3.5 py-2.5 border-b border-border align-middle">{plan}</td>
                    <td className="px-3.5 py-2.5 border-b border-border align-middle">{billing}</td>
                    <td className="px-3.5 py-2.5 border-b border-border align-middle text-right font-mono text-[12.5px]">{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-[18px] py-3 text-xs text-text-muted">
            Reference figures from the project documentation. Subscription tiers are served first because their cost is already paid; API-key tiers meter per token.
          </p>
        </Card>
      </div>
    </div>
  );
}
