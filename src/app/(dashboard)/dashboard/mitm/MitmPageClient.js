"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Badge, Toggle, Input } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { MITM_TOOLS } from "@/shared/constants/cliTools";
import { getModelsByProviderId } from "@/shared/constants/models";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { MitmToolCard } from "@/app/(dashboard)/dashboard/cli-tools/components";

/* MITM (audit MI-01..MI-06; MI-04 wired in Phase 4c — the status payload
   now carries caFingerprintSha256 and /api/cli-tools/antigravity-mitm/ca
   serves the CA PEM download).
   The server start/stop + trust-cert actions (incl. the sudo password and
   port-443 conflict flows) are lifted from MitmServerCard, which is no
   longer rendered: its Base URL / API-key picker UI is not part of the new
   layout — start uses the first dashboard API key (or the local default)
   and the router base URL reported by the status endpoint.
   The per-tool MitmToolCard grid below the g2 is a flagged carry-over:
   per-tool enable/model assignment has no other home and is not in §II.24. */

const DEFAULT_MITM_ROUTER_BASE = "http://localhost:667";

const STEPS = [
  "Bansur Router generates a local root CA on first run and installs it into your system trust store.",
  "Enabled tools are launched with the local proxy environment, so their API traffic lands here instead of the provider directly.",
  "Requests are translated, quota-checked, and routed like any other request — combos and fallback apply unchanged.",
  "Turn MITM off and the tools go back to talking to their providers directly. Nothing is modified on disk besides the trust-store entry.",
];

function Kv({ k, children }) {
  return (
    <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px] last:border-b-0">
      <span className="text-text-muted">{k}</span>
      <span className="font-mono text-[12.5px] text-right">{children}</span>
    </div>
  );
}

function Dot({ on }) {
  return on ? (
    <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-brand-500" />
  ) : (
    <span className="inline-block w-2 h-2 rounded-full shrink-0 border-[1.5px] border-[#a7afb6]" />
  );
}

export default function MitmPageClient() {
  const notify = useNotificationStore();
  const [connections, setConnections] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [modelAliases, setModelAliases] = useState({});
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [expandedTool, setExpandedTool] = useState(null);

  // Server state + action machinery lifted from MitmServerCard
  const [status, setStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [sudoPassword, setSudoPassword] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [port443Conflict, setPort443Conflict] = useState(null);

  const serverIsWindows = status?.isWin === true;
  const canRunWithoutPassword =
    serverIsWindows || status?.hasCachedPassword || status?.needsSudoPassword === false;
  const isAdmin = status?.isAdmin !== false;
  const isRunning = status?.running === true;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/cli-tools/antigravity-mitm");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      setStatus({ running: false, certExists: false, certTrusted: false, dnsStatus: {} });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetch("/api/providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConnections(d?.connections || []))
      .catch(() => {});
    fetch("/api/keys")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setApiKeys(d?.keys || []))
      .catch(() => {});
    fetch("/api/models/alias")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setModelAliases(d?.aliases || {}))
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCloudEnabled(d?.cloudEnabled || false))
      .catch(() => {});
  }, [fetchStatus]);

  const handleAction = (action) => {
    setActionError(null);
    if (!status) return;
    if (canRunWithoutPassword) {
      doAction(action, "");
    } else {
      setPendingAction(action);
      setShowPasswordModal(true);
      setModalError(null);
    }
  };

  const doAction = async (action, password, forceKillPort443 = false) => {
    setActionLoading(true);
    setActionError(null);
    try {
      let res;
      if (action === "trust-cert") {
        res = await fetch("/api/cli-tools/antigravity-mitm", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "trust-cert", sudoPassword: password }),
        });
      } else if (action === "start") {
        const keyToUse =
          (apiKeys?.length > 0 ? apiKeys[0].key : null) ||
          (!cloudEnabled ? "sk_bansur-router" : null);
        res = await fetch("/api/cli-tools/antigravity-mitm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: keyToUse,
            sudoPassword: password,
            mitmRouterBaseUrl: status?.mitmRouterBaseUrl || DEFAULT_MITM_ROUTER_BASE,
            forceKillPort443,
          }),
        });
      } else {
        res = await fetch("/api/cli-tools/antigravity-mitm", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sudoPassword: password }),
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "PORT_443_BUSY" && data.portOwner) {
          setShowPasswordModal(false);
          setPort443Conflict({ owner: data.portOwner, password });
          return;
        }
        setActionError(data.error || `Failed to ${action} MITM server`);
        return;
      }
      setShowPasswordModal(false);
      setSudoPassword("");
      setPort443Conflict(null);
      await fetchStatus();
    } catch (e) {
      setActionError(e.message || "Network error");
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const handleConfirmPassword = () => {
    if (!sudoPassword.trim()) {
      setModalError("Sudo password is required");
      return;
    }
    doAction(pendingAction, sudoPassword);
  };

  const getActiveProviders = () => connections.filter((c) => c.isActive !== false);

  const hasActiveProviders = () => {
    const active = getActiveProviders();
    return active.some(
      (conn) =>
        getModelsByProviderId(conn.provider).length > 0 ||
        isOpenAICompatibleProvider(conn.provider) ||
        isAnthropicCompatibleProvider(conn.provider)
    );
  };

  const mitmTools = Object.entries(MITM_TOOLS);
  const mitmStatus = status || { running: false, certExists: false, dnsStatus: {}, hasCachedPassword: false };
  const enabledToolNames = mitmTools
    .filter(([toolId]) => mitmStatus.dnsStatus?.[toolId])
    .map(([, tool]) => tool.name);

  return (
    <div className="flex w-full flex-col">
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">MITM</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Some tools cannot be pointed at a custom endpoint. The MITM layer intercepts their traffic locally and reroutes it through Bansur Router.</p>
      </div>

      {/* Warning banner — restored (Option 2 batch 5, MI-02): pre-removal
          position at the top of the page, above the status card. */}
      <div className="flex items-start gap-2 px-3.5 py-3 mb-3.5 rounded-md bg-surface-2 border border-border border-l-[3px] border-l-text-main">
        <span className="material-symbols-outlined text-[16px] text-text-muted mt-0.5 shrink-0">warning</span>
        <p className="text-xs text-text-main dark:text-text-muted leading-relaxed">
          ⚠️ MITM intercepts HTTPS traffic of IDE tools (Antigravity, GitHub Copilot, Kiro) via local CA to redirect requests to your providers. May violate ToS → account ban. Use at your own risk.
        </p>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2 items-start">
        {/* Status */}
        <Card>
          <div className="flex items-center gap-3.5 py-[13px] pt-[2px] border-b border-border">
            <Dot on={isRunning} />
            <div className="grow">
              <b className="block text-[13.5px] font-semibold">MITM interception</b>
              <span className="text-[12.5px] text-text-muted">
                {isRunning
                  ? "Proxy is running for enabled tools on this machine."
                  : "Proxy is stopped. Enabled tools talk to their providers directly."}
              </span>
            </div>
            {isRunning ? <Badge variant="primary">Running</Badge> : <Badge variant="default">Stopped</Badge>}
            <Toggle
              checked={isRunning}
              onChange={() => handleAction(isRunning ? "stop" : "start")}
              disabled={!status || actionLoading || (serverIsWindows && !isAdmin && !isRunning)}
            />
          </div>

          <div className="mt-2">
            <Kv k="Root CA">
              {mitmStatus.certTrusted
                ? "Installed in system trust store"
                : mitmStatus.certExists
                  ? "Generated · not installed"
                  : "Not generated"}
            </Kv>
            <Kv k="CA fingerprint (SHA-256)">
              {mitmStatus.caFingerprintSha256 ? (
                <span className="inline-block max-w-[260px] break-all align-top">
                  {mitmStatus.caFingerprintSha256}
                </span>
              ) : (
                "—"
              )}
            </Kv>
            <Kv k="Intercepted tools">{enabledToolNames.length > 0 ? enabledToolNames.join(" · ") : "None"}</Kv>
          </div>

          {actionError && <p className="text-xs text-text-muted mt-3">{actionError}</p>}
          {serverIsWindows && !isAdmin && (
            <p className="text-xs text-text-muted mt-3">Administrator required — restart Bansur Router as Administrator to use MITM</p>
          )}

          <div className="flex items-center gap-2 mt-3.5 flex-wrap">
            <Button
              variant="secondary"
              disabled={!mitmStatus.caFingerprintSha256}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mitmStatus.caFingerprintSha256);
                  notify.success("Fingerprint copied");
                } catch {
                  notify.error("Failed to copy fingerprint");
                }
              }}
            >
              Copy fingerprint
            </Button>
            <Button
              variant="secondary"
              disabled={!mitmStatus.certExists}
              onClick={() => {
                window.location.href = "/api/cli-tools/antigravity-mitm/ca";
              }}
            >
              Download CA
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction("trust-cert")}
              loading={actionLoading}
              disabled={!status || !mitmStatus.certExists}
            >
              Reinstall CA
            </Button>
          </div>
        </Card>

        {/* How interception works */}
        <Card>
          <h3 className="text-[13.5px] font-semibold mb-3.5">How interception works</h3>
          <ol>
            {STEPS.map((text, i) => (
              <li key={i} className="flex gap-3 py-2.5 border-b border-border last:border-b-0 text-[13.5px]">
                <span className="w-[22px] h-[22px] shrink-0 border-[1.5px] border-brand-500 rounded-full flex items-center justify-center font-mono text-[11.5px] font-semibold">
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* Per-tool cards — flagged carry-over (see header comment) */}
      <div className="grid gap-3.5 mt-3.5">
        {mitmTools.map(([toolId, tool]) => (
          <MitmToolCard
            key={toolId}
            tool={tool}
            isExpanded={expandedTool === toolId}
            onToggle={() => setExpandedTool(expandedTool === toolId ? null : toolId)}
            serverRunning={mitmStatus.running}
            dnsActive={mitmStatus.dnsStatus?.[toolId] || false}
            hasCachedPassword={mitmStatus.hasCachedPassword || false}
            needsSudoPassword={mitmStatus.needsSudoPassword !== false}
            isWin={mitmStatus.isWin === true}
            apiKeys={apiKeys}
            activeProviders={getActiveProviders()}
            hasActiveProviders={hasActiveProviders()}
            modelAliases={modelAliases}
            cloudEnabled={cloudEnabled}
            onDnsChange={(data) => setStatus((prev) => ({ ...(prev || {}), dnsStatus: data.dnsStatus ?? prev?.dnsStatus }))}
          />
        ))}
      </div>

      {/* Sudo password modal (lifted from MitmServerCard) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xl sm:p-6">
            <h3 className="font-semibold text-text-main">Sudo Password Required</h3>
            <p className="text-xs text-text-muted">Required for SSL certificate and server startup</p>
            <Input
              type="password"
              placeholder="Enter sudo password"
              value={sudoPassword}
              onChange={(e) => setSudoPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !actionLoading) handleConfirmPassword(); }}
            />
            {modalError && <p className="text-xs text-text-main">{modalError}</p>}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowPasswordModal(false); setSudoPassword(""); setModalError(null); }} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmPassword} loading={actionLoading}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Port 443 conflict modal (lifted from MitmServerCard) */}
      {port443Conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xl sm:p-6">
            <h3 className="font-semibold text-text-main">Port 443 Already In Use</h3>
            <div className="flex flex-col gap-1 text-xs text-text-muted">
              <p>Port 443 is currently used by another process:</p>
              <p className="font-mono text-text-main" data-i18n-skip="true">
                {port443Conflict.owner.name} (PID {port443Conflict.owner.pid})
              </p>
              <p>Kill this process to start MITM Server?</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setPort443Conflict(null); setActionLoading(false); }} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => doAction("start", port443Conflict?.password || "", true)} loading={actionLoading}>
                Kill &amp; Start
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
