"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

// Option-2 restoration (batch 4): the Proxy Pools Batch Import + relay
// deploy UI dropped by the Phase-4 spec rebuild (PP-02 / audit §II.24),
// restored as ADDITIONS next to the spec table's "+ New pool" button.
// Batch Import posts to the existing pools API using the current pool
// model (endpoints[]); the relay modals post to the still-existing
// deploy routes (/api/proxy-pools/{vercel,cloudflare,deno,netlify}-deploy),
// whose request fields are unchanged. This component is UI-only — it
// never touches router/proxy-pool resolution semantics.

function parseProxyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.includes("://")) {
    const parsed = new URL(trimmed);
    const hostLabel = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    return {
      proxyUrl: parsed.toString(),
      name: `Imported ${hostLabel}`,
    };
  }

  const parts = trimmed.split(":");
  if (parts.length === 4) {
    const [host, port, username, password] = parts;
    if (!host || !port || !username || !password) {
      throw new Error("Invalid host:port:user:pass format");
    }
    const proxyUrl = `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
    const parsed = new URL(proxyUrl);
    return {
      proxyUrl: parsed.toString(),
      name: `Imported ${host}:${port}`,
    };
  }

  throw new Error("Unsupported format");
}

export default function PoolExtras({ pools, onChanged }) {
  const notify = useNotificationStore();
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [showVercelModal, setShowVercelModal] = useState(false);
  const [showCloudflareModal, setShowCloudflareModal] = useState(false);
  const [showDenoModal, setShowDenoModal] = useState(false);
  const [showNetlifyModal, setShowNetlifyModal] = useState(false);
  const [showRelayMenu, setShowRelayMenu] = useState(false);
  const [batchImportText, setBatchImportText] = useState("");
  const [vercelForm, setVercelForm] = useState({ vercelToken: "", projectName: "vercel-relay" });
  const [cloudflareForm, setCloudflareForm] = useState({ accountId: "", apiToken: "", projectName: "cloudflare-relay" });
  const [denoForm, setDenoForm] = useState({ denoToken: "", orgDomain: "", projectName: "" });
  const [netlifyForm, setNetlifyForm] = useState({ netlifyToken: "", projectName: "netlify-relay" });
  const [importing, setImporting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const relayMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (relayMenuRef.current && !relayMenuRef.current.contains(e.target)) {
        setShowRelayMenu(false);
      }
    };
    if (showRelayMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showRelayMenu]);

  const openBatchImportModal = () => {
    setBatchImportText("");
    setShowBatchImportModal(true);
  };
  const closeBatchImportModal = () => {
    if (importing) return;
    setShowBatchImportModal(false);
  };
  const openVercelModal = () => {
    setVercelForm({ vercelToken: "", projectName: "vercel-relay" });
    setShowVercelModal(true);
  };
  const closeVercelModal = () => {
    if (deploying) return;
    setShowVercelModal(false);
  };
  const openCloudflareModal = () => {
    setCloudflareForm({ accountId: "", apiToken: "", projectName: "cloudflare-relay" });
    setShowCloudflareModal(true);
  };
  const closeCloudflareModal = () => {
    if (deploying) return;
    setShowCloudflareModal(false);
  };
  const openDenoModal = () => {
    setDenoForm({ denoToken: "", orgDomain: "", projectName: "" });
    setShowDenoModal(true);
  };
  const closeDenoModal = () => {
    if (deploying) return;
    setShowDenoModal(false);
  };
  const openNetlifyModal = () => {
    setNetlifyForm({ netlifyToken: "", projectName: "netlify-relay" });
    setShowNetlifyModal(true);
  };
  const closeNetlifyModal = () => {
    if (deploying) return;
    setShowNetlifyModal(false);
  };

  const handleBatchImport = async () => {
    const lines = batchImportText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      notify.warning("Please paste at least one proxy line.");
      return;
    }

    const parsedEntries = [];
    const invalidLines = [];

    lines.forEach((line, index) => {
      try {
        const parsed = parseProxyLine(line);
        if (parsed) parsedEntries.push({ ...parsed, lineNumber: index + 1 });
      } catch (error) {
        invalidLines.push(`Line ${index + 1}: ${error.message}`);
      }
    });

    if (invalidLines.length > 0) {
      notify.error(`Invalid proxy format:\n${invalidLines.join("\n")}`);
      return;
    }

    setImporting(true);
    try {
      // Dedupe against every endpoint URL already in a pool (the current
      // model stores endpoints[]; proxyUrl mirrors the first endpoint).
      const existingUrls = new Set();
      for (const pool of pools || []) {
        if (pool.proxyUrl) existingUrls.add(pool.proxyUrl.trim());
        for (const e of pool.endpoints || []) {
          if (e?.url) existingUrls.add(e.url.trim());
        }
      }

      let created = 0;
      let skipped = 0;
      let failed = 0;

      for (const entry of parsedEntries) {
        if (existingUrls.has(entry.proxyUrl)) {
          skipped += 1;
          continue;
        }
        const res = await fetch("/api/proxy-pools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: entry.name,
            endpoints: [{ url: entry.proxyUrl }],
            isActive: true,
          }),
        });
        if (res.ok) {
          created += 1;
          existingUrls.add(entry.proxyUrl);
        } else {
          failed += 1;
        }
      }

      await onChanged?.();
      setShowBatchImportModal(false);
      notify.success(`Batch import completed: Created ${created}, Skipped ${skipped}, Failed ${failed}`);
    } catch (error) {
      console.log("Error batch importing proxies:", error);
      notify.error("Batch import failed");
    } finally {
      setImporting(false);
    }
  };

  const deploy = async (url, form, closeModal, label) => {
    setDeploying(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await onChanged?.();
        closeModal();
        notify.success(`Deployed: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy failed");
      }
    } catch (error) {
      console.log(`Error deploying ${label} relay:`, error);
      notify.error("Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleVercelDeploy = () =>
    deploy("/api/proxy-pools/vercel-deploy", vercelForm, () => setShowVercelModal(false), "Vercel");
  const handleCloudflareDeploy = () =>
    deploy("/api/proxy-pools/cloudflare-deploy", cloudflareForm, () => setShowCloudflareModal(false), "Cloudflare");
  const handleDenoDeploy = () =>
    deploy("/api/proxy-pools/deno-deploy", denoForm, () => setShowDenoModal(false), "Deno");
  const handleNetlifyDeploy = () =>
    deploy("/api/proxy-pools/netlify-deploy", netlifyForm, () => setShowNetlifyModal(false), "Netlify");

  return (
    <>
      <div className="relative" ref={relayMenuRef}>
        <Button size="sm" variant="secondary" onClick={() => setShowRelayMenu(!showRelayMenu)}>
          Deploy Relay
          <span className="material-symbols-outlined ml-1 text-[18px]">
            {showRelayMenu ? "expand_less" : "expand_more"}
          </span>
        </Button>
        {showRelayMenu && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-brand border border-border bg-surface p-1 shadow-pop">
            <button
              onClick={() => { openCloudflareModal(); setShowRelayMenu(false); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-main transition-colors hover:bg-surface-2"
            >
              <span className="material-symbols-outlined text-[20px] text-primary">cloud</span>
              Cloudflare Relay
            </button>
            <button
              onClick={() => { openVercelModal(); setShowRelayMenu(false); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-main transition-colors hover:bg-surface-2"
            >
              <span className="material-symbols-outlined text-[20px] text-text-muted">cloud_upload</span>
              Vercel Relay
            </button>
            <button
              onClick={() => { openDenoModal(); setShowRelayMenu(false); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-main transition-colors hover:bg-surface-2"
            >
              <span className="material-symbols-outlined text-[20px] text-text-main">terminal</span>
              Deno Relay
            </button>
            <button
              onClick={() => { openNetlifyModal(); setShowRelayMenu(false); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-main transition-colors hover:bg-surface-2"
            >
              <span className="material-symbols-outlined text-[20px] text-text-main">deployed_code</span>
              Netlify Relay
            </button>
          </div>
        )}
      </div>

      <Button size="sm" variant="secondary" onClick={openBatchImportModal}>
        Batch Import
      </Button>

      <Modal isOpen={showBatchImportModal} title="Batch Import Proxies" onClose={closeBatchImportModal}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-text-main mb-1 block">Paste Proxy List (One per line)</label>
            <textarea
              value={batchImportText}
              onChange={(e) => setBatchImportText(e.target.value)}
              placeholder={"http://user:pass@127.0.0.1:7897\n127.0.0.1:7897:user:pass"}
              className="w-full min-h-[180px] py-2 px-3 text-sm text-text-main bg-surface border border-border rounded-md focus:outline-none focus:border-brand-500 focus:shadow-[var(--shadow-focus)] font-mono text-[12.5px] transition-all"
            />
            <p className="text-xs text-text-muted mt-1">
              Supported formats: protocol://user:pass@host:port, host:port:user:pass. Each line
              becomes its own pool with a single endpoint.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button fullWidth onClick={handleBatchImport} disabled={!batchImportText.trim() || importing}>
              {importing ? "Importing..." : "Import"}
            </Button>
            <Button fullWidth variant="ghost" onClick={closeBatchImportModal} disabled={importing}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showVercelModal} title="Deploy Vercel Relay" onClose={closeVercelModal}>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-surface-2 border border-border p-3 flex flex-col gap-1.5">
            <p className="text-sm text-text-main font-medium">What is Vercel Relay?</p>
            <p className="text-xs text-text-muted">
              Deploys an edge relay function to Vercel. All AI provider requests will be forwarded through Vercel&apos;s edge network, masking your real IP from providers.
            </p>
            <ul className="text-xs text-text-muted list-disc pl-4 space-y-0.5">
              <li>Your IP is replaced by Vercel&apos;s dynamic edge IPs (hundreds of IPs across 20+ global regions)</li>
              <li>Vercel serves millions of apps — providers can&apos;t block Vercel IPs without affecting legitimate traffic</li>
              <li>Free tier: 100GB bandwidth/month, 500K edge invocations</li>
              <li>Deploy multiple relays on different accounts for more IP diversity</li>
            </ul>
          </div>
          <Input
            label="Vercel API Token"
            value={vercelForm.vercelToken}
            onChange={(e) => setVercelForm((prev) => ({ ...prev, vercelToken: e.target.value }))}
            placeholder="your-vercel-api-token"
            hint={<>Token is used once for deployment and not stored. <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get token →</a></>}
            type="password"
          />
          <Input
            label="Project Name"
            value={vercelForm.projectName}
            onChange={(e) => setVercelForm((prev) => ({ ...prev, projectName: e.target.value }))}
            placeholder="my-relay"
            hint="Unique name for your Vercel project. Leave empty for auto-generated name."
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button fullWidth onClick={handleVercelDeploy} disabled={!vercelForm.vercelToken.trim() || deploying}>
              {deploying ? "Deploying... (may take ~1 min)" : "Deploy"}
            </Button>
            <Button fullWidth variant="ghost" onClick={closeVercelModal} disabled={deploying}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCloudflareModal} title="Deploy Cloudflare Relay" onClose={closeCloudflareModal}>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-surface-2 border border-border p-3 flex flex-col gap-1.5">
            <p className="text-sm text-text-main font-medium">What is Cloudflare Relay?</p>
            <p className="text-xs text-text-muted">
              Deploys a Cloudflare Worker as a proxy relay. All AI provider requests will be forwarded through Cloudflare&apos;s global edge network.
            </p>
            <ul className="text-xs text-text-muted list-disc pl-4 space-y-0.5">
              <li>High performance global routing and IP masking via Cloudflare Workers</li>
              <li>Free tier: 100,000 requests per day</li>
              <li>Requires Cloudflare Account ID and a Workers API Token (Edit Workers permission)</li>
            </ul>
            <div className="mt-2 pt-2 border-t border-border text-xs text-text-muted">
              <p className="font-medium text-text-main mb-1">How to generate your API Token:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Go to <b>My Profile</b> → <b>API Tokens</b> → <b>Create Token</b></li>
                <li>Scroll down to <b>Custom Token</b> and click <b>Get started</b></li>
                <li>Under <b>Permissions</b>: Account | Workers Scripts | Edit</li>
                <li>Under <b>Account Resources</b>: Include | Account | <i>Your Account Name</i></li>
                <li>Click <b>Continue to summary</b> → <b>Create Token</b></li>
              </ol>
            </div>
          </div>
          <Input
            label="Account ID"
            value={cloudflareForm.accountId}
            onChange={(e) => setCloudflareForm((prev) => ({ ...prev, accountId: e.target.value }))}
            placeholder="your-cloudflare-account-id"
            hint={<>Found on the right side of the Cloudflare dashboard overview page.</>}
          />
          <Input
            label="API Token"
            value={cloudflareForm.apiToken}
            onChange={(e) => setCloudflareForm((prev) => ({ ...prev, apiToken: e.target.value }))}
            placeholder="your-cloudflare-api-token"
            hint={<>Requires "Workers Scripts: Edit" permission. <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get token →</a></>}
            type="password"
          />
          <Input
            label="Worker Name"
            value={cloudflareForm.projectName}
            onChange={(e) => setCloudflareForm((prev) => ({ ...prev, projectName: e.target.value }))}
            placeholder="my-relay"
            hint="Unique name for your Cloudflare Worker. Leave empty for auto-generated name."
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button fullWidth onClick={handleCloudflareDeploy} disabled={!cloudflareForm.accountId.trim() || !cloudflareForm.apiToken.trim() || deploying}>
              {deploying ? "Deploying..." : "Deploy Worker"}
            </Button>
            <Button fullWidth variant="ghost" onClick={closeCloudflareModal} disabled={deploying}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDenoModal} title="Deploy Deno Relay" onClose={closeDenoModal}>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-surface-2 border border-border p-3 flex flex-col gap-1.5">
            <p className="text-sm text-text-main font-medium">What is Deno Relay?</p>
            <p className="text-xs text-text-muted">
              Deploys a relay worker to Deno Deploy&apos;s global edge network. All AI provider requests are forwarded through Deno&apos;s edge, masking your real IP.
            </p>
            <ul className="text-xs text-text-muted list-disc pl-4 space-y-0.5">
              <li>Deno Deploy v2 runs on a high-performance global edge network</li>
              <li>Free tier: 1M requests &amp; 100GiB outbound traffic per month</li>
              <li>No per-request CPU time limits (unlike Vercel/Cloudflare)</li>
              <li>Support up to 20 active apps &amp; 50 custom domains</li>
              <li>Deploy multiple relays for maximum IP diversity</li>
            </ul>
            <div className="mt-2 pt-2 border-t border-border text-xs text-text-muted">
              <p className="font-medium text-text-main mb-1">How to generate API token:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Go to <b>console.deno.com</b></li>
                <li>Select your <b>Organization</b> → <b>Settings</b> → <b>Organization Tokens</b></li>
                <li>Create a <b>Organization Token</b> (prefix <b>ddo_</b>)</li>
              </ol>
            </div>
          </div>
          <Input
            label="Deno Deploy API Token"
            value={denoForm.denoToken}
            onChange={(e) => setDenoForm((prev) => ({ ...prev, denoToken: e.target.value }))}
            placeholder="ddo_xxxxxxxxxxxxxxxx"
            hint={<>Token is used once for deployment, not stored. Found in Organization Settings.</>}
            type="password"
          />
          <Input
            label="Organization Domain"
            value={denoForm.orgDomain}
            onChange={(e) => setDenoForm((prev) => ({ ...prev, orgDomain: e.target.value }))}
            placeholder="your-org.deno.net"
            hint="Organization's default domain. Your relay URL will be in the format: https://my-relay.your-org.deno.net"
          />
          <Input
            label="App Name"
            value={denoForm.projectName}
            onChange={(e) => setDenoForm((prev) => ({ ...prev, projectName: e.target.value }))}
            placeholder="deno-relay"
            hint="Unique app name. Leave empty for auto-generated name."
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button fullWidth onClick={handleDenoDeploy} disabled={!denoForm.denoToken.trim() || !denoForm.orgDomain.trim() || deploying}>
              {deploying ? "Deploying..." : "Deploy Relay"}
            </Button>
            <Button fullWidth variant="ghost" onClick={closeDenoModal} disabled={deploying}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showNetlifyModal} title="Deploy Netlify Relay" onClose={closeNetlifyModal}>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-surface-2 border border-border p-3 flex flex-col gap-1.5">
            <p className="text-sm text-text-main font-medium">What is Netlify Relay?</p>
            <p className="text-xs text-text-muted">
              Deploys a serverless relay function to Netlify&apos;s global edge network. All AI provider requests are forwarded through Netlify&apos;s edge, masking your real IP.
            </p>
            <ul className="text-xs text-text-muted list-disc pl-4 space-y-0.5">
              <li>Runs on Netlify Functions with a 60-second execution limit and streaming support</li>
              <li>Free tier: 125,000 function invocations and 100GB bandwidth per month</li>
              <li>Relay URL format: https://your-site.netlify.app/.netlify/functions/relay</li>
              <li>Deploy multiple relays on different accounts for more IP diversity</li>
            </ul>
            <div className="mt-2 pt-2 border-t border-border text-xs text-text-muted">
              <p className="font-medium text-text-main mb-1">How to generate API token:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Go to <b>User Settings</b> → <b>Applications</b> → <b>Personal access tokens</b></li>
                <li>Select <b>New access token</b> and generate a token</li>
                <li>Copy the token — you won&apos;t see it again after leaving the page</li>
              </ol>
            </div>
          </div>
          <Input
            label="Netlify API Token"
            value={netlifyForm.netlifyToken}
            onChange={(e) => setNetlifyForm((prev) => ({ ...prev, netlifyToken: e.target.value }))}
            placeholder="nfp_xxxxxxxxxxxxxxxx"
            hint={<>Token is used once for deployment and not stored. <a href="https://app.netlify.com/user/applications#personal-access-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get token →</a></>}
            type="password"
          />
          <Input
            label="Site Name"
            value={netlifyForm.projectName}
            onChange={(e) => setNetlifyForm((prev) => ({ ...prev, projectName: e.target.value }))}
            placeholder="netlify-relay"
            hint="Unique site name (lowercase letters, numbers, hyphens). Your relay URL will be https://site-name.netlify.app/.netlify/functions/relay"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button fullWidth onClick={handleNetlifyDeploy} disabled={!netlifyForm.netlifyToken.trim() || deploying}>
              {deploying ? "Deploying... (may take ~1 min)" : "Deploy"}
            </Button>
            <Button fullWidth variant="ghost" onClick={closeNetlifyModal} disabled={deploying}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
