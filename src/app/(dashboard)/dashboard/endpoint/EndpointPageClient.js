"use client";

import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Card, Button, CardSkeleton, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useNotificationStore } from "@/store/notificationStore";
import useSettingsStore from "@/store/settingsStore";
import TunnelControls from "./components/TunnelControls";
import AllKeysSection from "./components/AllKeysSection";

// Phase-2 parity (audit E-01..E-07): one Endpoint card (URL box + KV +
// the two tunnel-related setting-rows) and one Dashboard API key card
// (primary key only).
// Option 2 restoration (batch 3): the E-08 extras return as ADDITIONS
// below the spec cards — TunnelControls (tunnel/Tailscale state
// machines + SecurityWarning banners) and AllKeysSection (all-keys
// list with create/toggle/delete + KeyAccessControls).

function maskDashboardKey(fullKey) {
  if (!fullKey) return "";
  const first = fullKey.indexOf("_");
  if (first === -1) return `${fullKey.slice(0, 4)}····`;
  const second = fullKey.indexOf("_", first + 1);
  const prefix = second === -1 ? fullKey.slice(0, first + 1) : fullKey.slice(0, second + 1);
  return `${prefix}····`;
}

function formatCreatedDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function formatLastUsed(value) {
  if (!value) return "—";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} · ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function KvRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px] last:border-b-0">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-[12.5px] text-right">{value}</span>
    </div>
  );
}

export default function APIPageClient({ machineId }) {
  void machineId;
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [tunnelDashboardAccess, setTunnelDashboardAccess] = useState(false);
  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelDisplayUrl, setTunnelDisplayUrl] = useState("");
  const [tailscaleDisplay, setTailscaleDisplay] = useState("Off");
  const [healthOk, setHealthOk] = useState(null);
  const [keyStats, setKeyStats] = useState({});
  const [revealKey, setRevealKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [baseUrl, setBaseUrl] = useState("/v1");
  const [lanUrl, setLanUrl] = useState(null);

  const { copied, copy } = useCopyToClipboard();
  const notifySuccess = useNotificationStore((s) => s.success);
  const notifyError = useNotificationStore((s) => s.error);

  const fetchData = useCallback(async () => {
    try {
      const fetchKeys = async () => {
        const res = await fetch("/api/keys");
        if (!res.ok) return [];
        const data = await res.json();
        return data.keys || [];
      };

      let existing = await fetchKeys();
      // Auto-provision a default key for first-time users so the endpoint works out of the box.
      if (existing.length === 0) {
        try {
          const createRes = await fetch("/api/keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Default Key" }),
          });
          if (createRes.ok) existing = await fetchKeys();
        } catch { /* fall through to empty render */ }
      }
      setKeys(existing);
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const [settingsData, statusRes] = await Promise.all([
        useSettingsStore.getState().fetchSettings(),
        fetch("/api/tunnel/status", { cache: "no-store" }).catch(() => null),
      ]);
      if (settingsData) {
        setRequireApiKey(settingsData.requireApiKey || false);
        setTunnelDashboardAccess(settingsData.tunnelDashboardAccess || false);
      }
      if (statusRes?.ok) {
        const data = await statusRes.json();
        const tEnabled = data.tunnel?.settingsEnabled ?? data.tunnel?.enabled ?? false;
        setTunnelEnabled(Boolean(tEnabled));
        setTunnelDisplayUrl(data.tunnel?.publicUrl || data.tunnel?.tunnelUrl || "");
        const tsEnabled = data.tailscale?.settingsEnabled ?? data.tailscale?.enabled ?? false;
        const tsUrl = data.tailscale?.tunnelUrl || "";
        setTailscaleDisplay(tsEnabled && tsUrl ? `${tsUrl}/v1` : "Off");
      }
    } catch (error) {
      console.log("Error loading settings:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    loadSettings();
  }, [fetchData, loadSettings]);

  // Health check (E-02 KV): live-check /api/health once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((res) => {
        if (!cancelled) setHealthOk(res.ok);
      })
      .catch(() => {
        if (!cancelled) setHealthOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Usage join for Last used / Requests with this key (E-05).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage/stats?period=all", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.byApiKey) setKeyStats(data.byApiKey);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydration fix: Only access window on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(`${window.location.origin}/v1`);
      const { protocol, hostname, port } = window.location;
      if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
        setLanUrl(`${protocol}//${hostname}:${port || "667"}/v1`);
      }
    }
  }, []);

  const handleRequireApiKey = async (value) => {
    try {
      const updated = await useSettingsStore.getState().patchSettings({ requireApiKey: value });
      if (updated) setRequireApiKey(value);
    } catch (error) {
      console.log("Error updating requireApiKey:", error);
    }
  };

  const handleTunnelDashboardAccess = async (value) => {
    try {
      const updated = await useSettingsStore.getState().patchSettings({ tunnelDashboardAccess: value });
      if (updated) setTunnelDashboardAccess(value);
    } catch (error) {
      console.log("Error updating tunnelDashboardAccess:", error);
    }
  };

  const copyWithToast = (text, id) => {
    copy(text, id);
    notifySuccess("Copied to clipboard");
  };

  const primaryKey = keys.find((k) => k.isActive !== false) || keys[0] || null;

  const primaryStats = (() => {
    if (!primaryKey) return null;
    const entries = Object.values(keyStats || {});
    return (
      entries.find((e) => e?.keyName && e.keyName === primaryKey.name) ||
      entries.find((e) => e?.apiKeyKey && e.apiKeyKey === primaryKey.key) ||
      null
    );
  })();

  const handleRegenerateKey = async () => {
    if (!primaryKey || regenerating) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: primaryKey.name }),
      });
      if (!res.ok) throw new Error("Failed to create replacement key");
      const del = await fetch(`/api/keys/${primaryKey.id}`, { method: "DELETE" });
      if (!del.ok) throw new Error("Failed to remove old key");
      setRevealKey(false);
      await fetchData();
      notifySuccess("Key regenerated");
    } catch (error) {
      notifyError(error.message || "Failed to regenerate key");
    } finally {
      setRegenerating(false);
    }
  };

  const handleCreateKey = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Default Key" }),
      });
      if (!res.ok) throw new Error("Failed to create key");
      await fetchData();
      notifySuccess("Key created");
    } catch (error) {
      notifyError(error.message || "Failed to create key");
    } finally {
      setRegenerating(false);
    }
  };

  const curlText = `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer YOUR_DASHBOARD_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "kr/claude-sonnet-4.5",
    "messages": [{ "role": "user", "content": "Refactor this function" }]
  }'`;

  const handleSendTestRequest = async () => {
    if (sending) return;
    if (!primaryKey) {
      notifyError("No dashboard key — create one first");
      return;
    }
    setSending(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const modelsRes = await fetch(`${origin}/v1/models`, {
        headers: { Authorization: `Bearer ${primaryKey.key}` },
      });
      if (!modelsRes.ok) throw new Error(`${modelsRes.status} ${modelsRes.statusText}`);
      const modelsData = await modelsRes.json().catch(() => ({}));
      const model = modelsData?.data?.[0]?.id;
      if (!model) throw new Error("No models available");
      const res = await fetch(`${origin}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${primaryKey.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hello" }],
        }),
      });
      // Drain the body so the connection can close cleanly.
      await res.text().catch(() => "");
      if (res.ok) {
        notifySuccess("200 OK");
      } else {
        notifyError(`${res.status} ${res.statusText}`);
      }
    } catch (error) {
      notifyError(error.message || "Test request failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3.5">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const healthValue =
    healthOk === null ? "GET /api/health · Checking…" : healthOk ? "GET /api/health · OK" : "GET /api/health · Unreachable";
  const tunnelValue = tunnelEnabled ? tunnelDisplayUrl || "On" : "Off · dashboard-only access";

  return (
    <div className="flex flex-col gap-3.5">
      {/* Page head */}
      <div className="mb-1.5">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Endpoint &amp; Key</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">One OpenAI-compatible endpoint for every tool. Keys are issued here, in the dashboard — nowhere else.</p>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2 items-start">
        {/* Endpoint Card */}
        <Card id="require-api-key">
          <h3 className="text-[13.5px] font-semibold mb-3.5">Endpoint</h3>

          <div className="flex items-center gap-2.5 border border-border-strong rounded-md px-3 py-2.5 bg-surface-2">
            <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-brand-500" />
            <span className="font-mono text-[13.5px] grow truncate">{baseUrl}</span>
            <Button size="sm" variant="secondary" onClick={() => copyWithToast(baseUrl, "endpoint_url")}>
              {copied === "endpoint_url" ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="mt-3.5">
            <KvRow label="Base URL (LAN)" value={lanUrl || "—"} />
            <KvRow label="Tailscale" value={tailscaleDisplay} />
            <KvRow label="Tunnel" value={tunnelValue} />
            <KvRow label="Health check" value={healthValue} />
          </div>

          <div className="flex items-center gap-3.5 py-[13px] border-b border-border">
            <div className="grow">
              <b className="block text-[13.5px] font-semibold">Require API key</b>
              <span className="text-[12.5px] text-text-muted">Reject requests to /v1 without a dashboard key</span>
            </div>
            <Toggle checked={requireApiKey} onChange={handleRequireApiKey} />
          </div>
          <div className="flex items-center gap-3.5 py-[13px]">
            <div className="grow">
              <b className="block text-[13.5px] font-semibold">Allow dashboard access via tunnel</b>
              <span className="text-[12.5px] text-text-muted">Expose this dashboard through the tunnel URL</span>
            </div>
            <Toggle checked={tunnelDashboardAccess} onChange={handleTunnelDashboardAccess} />
          </div>
        </Card>

        {/* Dashboard API key Card */}
        <Card>
          <h3 className="text-[13.5px] font-semibold mb-3.5">Dashboard API key</h3>

          <div className="flex items-center gap-2.5 border border-border-strong rounded-md px-3 py-2.5 bg-surface-2">
            <span className="font-mono text-[13px] grow truncate">
              {primaryKey ? (revealKey ? primaryKey.key : maskDashboardKey(primaryKey.key)) : "No key issued"}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!primaryKey}
              onClick={() => setRevealKey((prev) => !prev)}
            >
              {revealKey ? "Hide" : "Reveal"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!primaryKey}
              onClick={() => primaryKey && copyWithToast(primaryKey.key, "dashboard_key")}
            >
              {copied === "dashboard_key" ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex items-center gap-3.5 mt-3.5">
            {primaryKey ? (
              <>
                <Button variant="secondary" onClick={handleRegenerateKey} loading={regenerating}>
                  Regenerate key
                </Button>
                <span className="text-xs text-text-muted">Regenerating invalidates the old key everywhere it is pasted.</span>
              </>
            ) : (
              <Button variant="secondary" onClick={handleCreateKey} loading={regenerating}>
                Create key
              </Button>
            )}
          </div>

          <div className="h-px bg-border my-[18px]" />

          <div>
            <KvRow label="Key name" value={primaryKey?.name || "—"} />
            <KvRow label="Created" value={primaryKey ? formatCreatedDate(primaryKey.createdAt) : "—"} />
            <KvRow label="Last used" value={primaryStats ? formatLastUsed(primaryStats.lastUsed) : "—"} />
            <KvRow
              label="Requests with this key"
              value={primaryStats ? `${Number(primaryStats.requests || 0).toLocaleString()} total` : "—"}
            />
          </div>
        </Card>
      </div>

      {/* Restored extras (E-08): tunnel/Tailscale state machines +
          SecurityWarning banners, as additional cards below the spec
          endpoint card. The tunnel-dashboard-access toggle stays in the
          spec card above (single owner for that setting). */}
      <TunnelControls requireApiKey={requireApiKey} />

      {/* Restored extras (E-08): full secondary-key management under the
          spec Dashboard API key card. */}
      <AllKeysSection keys={keys} onRefresh={fetchData} requireApiKey={requireApiKey} />

      {/* Try it */}
      <Card padding="none">
        <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-border">
          <h3 className="text-[13.5px] font-semibold flex-1">Try it — POST /v1/chat/completions</h3>
          <Button size="sm" variant="secondary" onClick={() => copyWithToast(curlText, "tryit_curl")}>
            {copied === "tryit_curl" ? "Copied" : "Copy curl"}
          </Button>
        </div>
        <div className="px-[18px] py-4">
          <pre className="bg-brand-500 dark:bg-brand-900 text-[#e8ebed] rounded-brand px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] overflow-x-auto whitespace-pre">{`curl ${baseUrl}/chat/completions \\
  -H `}<span className="text-[#8b949c]">{`"Authorization: Bearer YOUR_DASHBOARD_KEY"`}</span>{` \\
  -H `}<span className="text-[#8b949c]">{`"Content-Type: application/json"`}</span>{` \\
  -d '{
    "model": "kr/claude-sonnet-4.5",
    "messages": [{ "role": "user", "content": "Refactor this function" }]
  }'`}</pre>
          <div className="flex items-center gap-3.5 mt-3.5 flex-wrap">
            <Button variant="secondary" onClick={handleSendTestRequest} loading={sending}>
              Send test request
            </Button>
            <span className="text-xs text-text-muted">
              Also available: <span className="font-mono">GET /v1/models</span> · <span className="font-mono">POST /v1/messages</span> (Claude format) · <span className="font-mono">POST /v1beta/...</span> (Gemini format)
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

APIPageClient.propTypes = {
  machineId: PropTypes.string.isRequired,
};
