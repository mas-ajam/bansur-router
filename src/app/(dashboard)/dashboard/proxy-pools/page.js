"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Modal, Toggle, ConfirmModal, Select } from "@/shared/components";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { useNotificationStore } from "@/store/notificationStore";
import PoolExtras from "./PoolExtras";

// Proxy Pools (audit §II.12, PP-01..PP-08) — rebuilt to the artifact in
// Phase 4: one table card (Pool | Endpoints | Rotation | Health |
// Used by | Enabled) over the Phase 4 pool model — endpoints[] with
// per-endpoint probe results, a rotation strategy the router actually
// consumes, and used-by provider names from the API. Option-2
// restoration (batch 4): Batch Import + the relay deploy modals return
// as additions in PoolExtras.js (UI only; router semantics untouched).
// Pool editing lives in the editor modal opened from "+ New pool" or
// by selecting a row.

const ROTATION_LABELS = {
  "round-robin": "Round robin",
  latency: "Latency",
  sticky: "Sticky per account",
};

const thClass =
  "text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap";
const tdClass = "px-3.5 py-2.5 border-b border-border align-middle";

const dotOn = "inline-block w-2 h-2 rounded-full shrink-0 bg-brand-500 align-middle";
const dotWarn =
  "inline-block w-2 h-2 rounded-full shrink-0 bg-surface border-[2.5px] border-brand-500 align-middle";
const dotOff =
  "inline-block w-2 h-2 rounded-full shrink-0 bg-transparent border-[1.5px] border-[#a7afb6] align-middle";

function providerName(providerId) {
  return AI_PROVIDERS[providerId]?.name || providerId || "—";
}

function maskEndpoint(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//…${u.port ? `:${u.port}` : ""}`;
  } catch {
    return url.length > 22 ? `${url.slice(0, 22)}…` : url;
  }
}

function endpointsSummary(pool) {
  const endpoints = pool.endpoints || [];
  if (endpoints.length === 0) return "—";
  const first = maskEndpoint(endpoints[0].url);
  return endpoints.length > 1 ? `${first} ×${endpoints.length}` : first;
}

function healthOf(pool) {
  if (pool.type !== "http") {
    if (pool.testStatus === "active") return { dot: dotOn, text: "OK" };
    if (pool.testStatus === "error") return { dot: dotWarn, text: "Failed" };
    return { dot: dotOff, text: "—" };
  }
  const endpoints = pool.endpoints || [];
  if (endpoints.length === 0) return { dot: dotOff, text: "—" };
  const tested = endpoints.filter((e) => e.testStatus);
  if (tested.length === 0) return { dot: dotOff, text: "Not tested" };
  const ok = endpoints.filter((e) => e.testStatus === "active").length;
  return { dot: ok === endpoints.length ? dotOn : dotWarn, text: `${ok}/${endpoints.length} OK` };
}

const emptyForm = {
  name: "",
  description: "",
  endpointsText: "",
  rotation: "round-robin",
  noProxy: "",
  strictProxy: false,
  isActive: true,
};

function formFromPool(pool) {
  return {
    name: pool.name || "",
    description: pool.description || "",
    endpointsText: (pool.endpoints || []).map((e) => e.url).join("\n"),
    rotation: pool.rotation || "round-robin",
    noProxy: pool.noProxy || "",
    strictProxy: pool.strictProxy === true,
    isActive: pool.isActive !== false,
  };
}

export default function ProxyPoolsPage() {
  const notify = useNotificationStore();
  const [pools, setPools] = useState(null);
  const [editing, setEditing] = useState(null); // pool object or "new"
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPools = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy-pools?includeUsage=true");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setPools(data.proxyPools || []);
    } catch {
      setPools((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    loadPools();
  }, [loadPools]);

  const openEditor = (pool) => {
    if (pool === "new") {
      setEditing("new");
      setForm(emptyForm);
    } else {
      setEditing(pool);
      setForm(formFromPool(pool));
    }
  };

  const handleSave = async () => {
    const endpoints = form.endpointsText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url }));
    if (!form.name.trim()) {
      notify.error("Pool name is required");
      return;
    }
    if (endpoints.length === 0) {
      notify.error("At least one endpoint URL is required");
      return;
    }
    // Preserve probe history for endpoints that survive the edit.
    const prior = editing && editing !== "new" ? editing.endpoints || [] : [];
    const merged = endpoints.map((e) => {
      const old = prior.find((p) => p.url === e.url);
      return old ? { ...old, url: e.url } : e;
    });
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      endpoints: merged,
      rotation: form.rotation,
      noProxy: form.noProxy.trim(),
      strictProxy: form.strictProxy,
      isActive: form.isActive,
    };
    setSaving(true);
    try {
      const isNew = editing === "new";
      const res = await fetch(isNew ? "/api/proxy-pools" : `/api/proxy-pools/${editing.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "save failed");
      notify.success(isNew ? "Proxy pool created" : "Proxy pool saved");
      setEditing(null);
      await loadPools();
    } catch (err) {
      notify.error(err.message || "Failed to save proxy pool");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!editing || editing === "new") return;
    setTesting(true);
    try {
      const res = await fetch(`/api/proxy-pools/${editing.id}/test`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "test failed");
      if (Array.isArray(data.endpoints)) {
        const ok = data.endpoints.filter((e) => e.ok).length;
        notify.success(`Health check: ${ok}/${data.endpoints.length} endpoints OK`);
      } else if (data.ok) {
        notify.success("Health check passed");
      } else {
        notify.error(data.error || "Health check failed");
      }
      await loadPools();
      const fresh = await fetch(`/api/proxy-pools/${editing.id}`).then((r) => r.json()).catch(() => null);
      if (fresh?.proxyPool) setEditing(fresh.proxyPool);
    } catch (err) {
      notify.error(err.message || "Failed to test proxy pool");
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || editing === "new") return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/proxy-pools/${editing.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      notify.success("Proxy pool deleted");
      setConfirmDelete(false);
      setEditing(null);
      await loadPools();
    } catch {
      notify.error("Failed to delete proxy pool");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleEnabled = async (pool, value) => {
    setPools((prev) => prev?.map((p) => (p.id === pool.id ? { ...p, isActive: value } : p)));
    try {
      const res = await fetch(`/api/proxy-pools/${pool.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: value }),
      });
      if (!res.ok) throw new Error("toggle failed");
    } catch {
      notify.error("Failed to update pool");
      await loadPools();
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Proxy Pools</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">
          Outbound proxies the router can send provider traffic through, grouped into pools with
          their own rotation strategy.
        </p>
      </div>

      <Card padding="none">
        <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border flex-wrap">
          <h3 className="text-[13.5px] font-semibold">Pools</h3>
          <div className="flex-1" />
          {/* Restored extras (Option 2 batch 4): Batch Import + relay
              deploy, as additions beside the spec "+ New pool". */}
          <PoolExtras pools={pools || []} onChanged={loadPools} />
          <Button size="sm" variant="primary" onClick={() => openEditor("new")}>
            + New pool
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th className={thClass}>Pool</th>
                <th className={thClass}>Endpoints</th>
                <th className={thClass}>Rotation</th>
                <th className={thClass}>Health</th>
                <th className={thClass}>Used by</th>
                <th className={thClass}>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {pools === null ? (
                <tr>
                  <td colSpan={6} className={`${tdClass} text-xs text-text-muted`}>
                    Loading pools…
                  </td>
                </tr>
              ) : pools.length === 0 ? (
                <tr>
                  <td colSpan={6} className={tdClass}>
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <span className="flex items-center justify-center w-11 h-11 rounded-full border border-border text-text-subtle">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9S14.5 18.4 12 21c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3z" />
                        </svg>
                      </span>
                      <p className="text-[13px] font-medium text-text-main">No proxy pools yet</p>
                      <p className="text-xs text-text-muted max-w-[380px]">
                        Pools group outbound proxy endpoints with a rotation strategy. Connections
                        assigned to a pool send their provider traffic through it.
                      </p>
                      <Button size="sm" variant="primary" onClick={() => openEditor("new")}>
                        + New pool
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                pools.map((pool) => {
                  const health = healthOf(pool);
                  const usedBy = pool.usedBy || [];
                  return (
                    <tr
                      key={pool.id}
                      className="cursor-pointer hover:bg-surface-2"
                      onClick={() => openEditor(pool)}
                    >
                      <td className={tdClass}>
                        <b className="text-[13.5px] font-semibold">{pool.name}</b>
                        {pool.description ? (
                          <div className="text-xs text-text-muted">{pool.description}</div>
                        ) : null}
                      </td>
                      <td className={`${tdClass} font-mono text-[12.5px]`}>
                        {endpointsSummary(pool)}
                      </td>
                      <td className={tdClass}>
                        {pool.type === "http" ? ROTATION_LABELS[pool.rotation] || "Round robin" : "—"}
                      </td>
                      <td className={tdClass}>
                        <span className={health.dot} />{" "}
                        <span className="font-mono text-[11.5px] font-semibold">{health.text}</span>
                      </td>
                      <td className={tdClass}>
                        {usedBy.length > 0 ? usedBy.map(providerName).join(", ") : "—"}
                      </td>
                      <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                        <Toggle
                          checked={pool.isActive !== false}
                          onChange={(v) => handleToggleEnabled(pool, v)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-text-muted mt-3.5">
        Health is probed every 60 seconds. A pool with no healthy endpoints is skipped
        automatically and requests fail over to <span className="font-mono">direct</span>.
      </p>

      {/* Pool editor */}
      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New proxy pool" : "Edit proxy pool"}
        footer={
          <div className="flex items-center gap-2.5">
            {editing && editing !== "new" ? (
              <>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
                <Button variant="secondary" onClick={handleTest} disabled={testing}>
                  {testing ? "Testing…" : "Test health"}
                </Button>
              </>
            ) : null}
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save pool"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="residential-id"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Jakarta exits"
          />
          <div>
            <label className="block text-[13px] font-medium text-text-main mb-1.5">
              Endpoints — one proxy URL per line
            </label>
            <textarea
              value={form.endpointsText}
              onChange={(e) => setForm({ ...form, endpointsText: e.target.value })}
              rows={4}
              placeholder={"socks5://user:pass@host:1080\nhttp://host:8080"}
              className="w-full px-[11px] py-2 text-sm font-mono text-text-main bg-surface border border-border-strong rounded-md focus:outline-none focus:border-brand-500 focus:shadow-[var(--shadow-focus)] transition-[border-color,box-shadow] duration-150"
            />
          </div>
          <Select
            label="Rotation"
            value={form.rotation}
            onChange={(e) => setForm({ ...form, rotation: e.target.value })}
            options={[
              { value: "round-robin", label: "Round robin" },
              { value: "latency", label: "Latency" },
              { value: "sticky", label: "Sticky per account" },
            ]}
          />
          <Input
            label="No proxy (bypass list)"
            value={form.noProxy}
            onChange={(e) => setForm({ ...form, noProxy: e.target.value })}
            placeholder="localhost,127.0.0.1"
          />
          <div className="flex items-center gap-3.5">
            <div className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-semibold">Strict proxy</b>
              <span className="text-[12.5px] text-text-muted">
                Fail requests instead of falling back to a direct connection when this pool is
                unusable.
              </span>
            </div>
            <Toggle
              checked={form.strictProxy}
              onChange={(v) => setForm({ ...form, strictProxy: v })}
            />
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-semibold">Enabled</b>
              <span className="text-[12.5px] text-text-muted">
                Disabled pools are skipped by the router.
              </span>
            </div>
            <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete proxy pool"
        message="This pool will be removed. Connections assigned to it will fall back to their direct connection settings."
        confirmText="Delete"
        loading={deleting}
      />
    </div>
  );
}
