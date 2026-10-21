"use client";

// Option 2 restoration (batch 3, E-08): the full secondary-key management
// section removed in phase 2 — keys list with create / pause-resume /
// delete and per-key KeyAccessControls — restored from the pre-removal
// implementation (d354e5b^) as an ADDITIONAL section under the spec
// Dashboard API key card (which keeps showing the primary key). The
// parent owns the keys state (its boot-time Default Key provisioning
// renders through the same list); this section only mutates via
// /api/keys and asks the parent to refetch.
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Card, Button, Input, Modal, ConfirmModal, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import KeyAccessControls from "./KeyAccessControls";
import SecurityWarning from "./SecurityWarning";

export default function AllKeysSection({ keys, onRefresh, requireApiKey }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [isRemoteHost, setIsRemoteHost] = useState(false);

  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    if (typeof window !== "undefined")
      setIsRemoteHost(!["localhost", "127.0.0.1", "::1"].includes(window.location.hostname));
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();

      if (res.ok) {
        setCreatedKey(data.key);
        await onRefresh();
        setNewKeyName("");
        setShowAddModal(false);
      }
    } catch (error) {
      console.log("Error creating key:", error);
    }
  };

  const handleDeleteKey = async (id) => {
    setConfirmState({
      title: "Delete API Key",
      message: "Delete this API key?",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
          if (res.ok) {
            setVisibleKeys((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            await onRefresh();
          }
        } catch (error) {
          console.log("Error deleting key:", error);
        }
      },
    });
  };

  const handleToggleKey = async (id, isActive) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch (error) {
      console.log("Error toggling key:", error);
    }
  };

  // Save a key's access (restricted flag + allow list).
  const handleUpdateKeyAccess = async (id, access) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.key) {
        await onRefresh();
      } else {
        console.log("Error updating key access:", data.error || res.status);
      }
    } catch (error) {
      console.log("Error updating key access:", error);
    }
  };

  const maskKey = (fullKey) => {
    if (!fullKey || fullKey.length <= 10) return fullKey || "";
    return fullKey.slice(0, 6) + "•".repeat(fullKey.length - 10) + fullKey.slice(-4);
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13.5px] font-semibold">All API keys</h3>
        <Button icon="add" size="sm" onClick={() => setShowAddModal(true)}>
          Create Key
        </Button>
      </div>

      {isRemoteHost && !requireApiKey && (
        <div className="mb-4">
          <SecurityWarning message="Endpoint is exposed without an API key." />
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">vpn_key</span>
          </div>
          <p className="text-text-main font-medium mb-1">No API keys yet</p>
          <p className="text-sm text-text-muted mb-4">Create your first API key to get started</p>
          <Button icon="add" onClick={() => setShowAddModal(true)}>
            Create Key
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`group flex items-start justify-between gap-3 py-3 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0 ${key.isActive === false ? "opacity-60" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{key.name}</p>
                <div className="flex items-center gap-2 mt-1 min-w-0 flex-wrap">
                  <code className="text-xs text-text-muted font-mono break-all min-w-0">
                    {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                  </code>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleKeyVisibility(key.id)}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-all"
                      title={visibleKeys.has(key.id) ? "Hide key" : "Show key"}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {visibleKeys.has(key.id) ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                    <button
                      onClick={() => copy(key.key, key.id)}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {copied === key.id ? "check" : "content_copy"}
                      </span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                </p>
                {key.isActive === false && (
                  <p className="text-xs text-primary mt-1">Paused</p>
                )}
                <KeyAccessControls
                  apiKey={key}
                  onChange={(access) => handleUpdateKeyAccess(key.id, access)}
                  onRequestRestrict={() => setConfirmState({
                    title: "Restrict API Key",
                    message: `Restrict API key "${key.name}"?\n\nIt will only be able to call the combos and models you add. Until you add one, it can call nothing.`,
                    onConfirm: async () => {
                      setConfirmState(null);
                      handleUpdateKeyAccess(key.id, { restricted: true, allow: key.access?.allow || [] });
                    },
                  })}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <Toggle
                  size="sm"
                  checked={key.isActive ?? true}
                  onChange={(checked) => {
                    if (key.isActive && !checked) {
                      setConfirmState({
                        title: "Pause API Key",
                        message: `Pause API key "${key.name}"?\n\nThis key will stop working immediately but can be resumed later.`,
                        onConfirm: async () => {
                          setConfirmState(null);
                          handleToggleKey(key.id, checked);
                        },
                      });
                    } else {
                      handleToggleKey(key.id, checked);
                    }
                  }}
                  title={key.isActive ? "Pause key" : "Resume key"}
                />
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  className="p-2 hover:bg-surface-2 rounded text-text-main opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Key Modal */}
      <Modal
        isOpen={showAddModal}
        title="Create API Key"
        onClose={() => {
          setShowAddModal(false);
          setNewKeyName("");
        }}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Production Key"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreateKey} fullWidth disabled={!newKeyName.trim()}>
              Create
            </Button>
            <Button
              onClick={() => {
                setShowAddModal(false);
                setNewKeyName("");
              }}
              variant="ghost"
              fullWidth
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Created Key Modal */}
      <Modal
        isOpen={!!createdKey}
        title="API Key Created"
        onClose={() => setCreatedKey(null)}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-surface-2 dark:bg-surface-2 border border-border dark:border-border rounded-lg p-4">
            <p className="text-sm text-text-muted dark:text-text-muted mb-2 font-medium">
              Save this key now!
            </p>
            <p className="text-sm text-text-muted dark:text-text-muted">
              This is the only time you will see this key. Store it securely.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={createdKey || ""}
              readOnly
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="secondary"
              icon={copied === "created_key" ? "check" : "content_copy"}
              onClick={() => copy(createdKey, "created_key")}
            >
              {copied === "created_key" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button onClick={() => setCreatedKey(null)} fullWidth>
            Done
          </Button>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </Card>
  );
}

AllKeysSection.propTypes = {
  keys: PropTypes.array.isRequired,
  onRefresh: PropTypes.func.isRequired,
  requireApiKey: PropTypes.bool,
};
