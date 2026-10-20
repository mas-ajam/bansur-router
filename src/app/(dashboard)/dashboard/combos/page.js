"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Card, Button, Input, Select, CardSkeleton, ConfirmModal } from "@/shared/components";
import SpecIcon from "@/shared/components/SpecIcon";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { useNotificationStore } from "@/store/notificationStore";
import { getModelsByProviderId } from "@/shared/constants/models";
import { AI_PROVIDERS, getProviderAlias } from "@/shared/constants/providers";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

// Vision Adapter (C-08, Phase 4): the select in the combo form is bound
// to the combo being edited — combo.visionAdapter (null = Off/none) — and
// is saved with the combo payload via POST/PUT /api/combos. The global
// settings.capacityAdapter pools still exist for the capacity-adapter
// runtime fallback; this page only reads the global vision pool to keep
// its model selectable in the per-combo options.
const CAPACITY_ADAPTER_CAPS = [
  { key: "vision", label: "Vision" },
  { key: "audioInput", label: "Audio" },
];
const EMPTY_CAP_ENTRY = { enabled: true, roundRobin: false, models: [] };
const EMPTY_CAPACITY_ADAPTER = {
  vision: { ...EMPTY_CAP_ENTRY },
  pdf: { ...EMPTY_CAP_ENTRY },
  audioInput: { ...EMPTY_CAP_ENTRY },
  videoInput: { ...EMPTY_CAP_ENTRY },
};
const DEFAULT_FALLBACK_MODEL = "oc/mimo-v2.6-flash-free";
const upgradeLegacyModel = (m) => (m === "oc/mimo-v2.5-free" ? DEFAULT_FALLBACK_MODEL : m);

// Backward-compat: legacy stored form was an array of {model, enabled}.
function normalizeCapEntry(entry) {
  if (Array.isArray(entry)) {
    return { enabled: true, roundRobin: false, models: entry.map((e) => upgradeLegacyModel(e?.model || e)).filter(Boolean) };
  }
  if (entry && typeof entry === "object") {
    return {
      enabled: entry.enabled !== false,
      roundRobin: !!entry.roundRobin,
      models: Array.isArray(entry.models) ? entry.models.map(upgradeLegacyModel).filter(Boolean) : [],
    };
  }
  return { ...EMPTY_CAP_ENTRY };
}

const STRATEGY_OPTIONS = [
  { value: "fallback", label: "Fallback (in order)" },
  { value: "round-robin", label: "Round robin" },
  { value: "fusion", label: "Fusion (panel + judge)" },
];
const STRATEGY_TEXT = {
  fallback: "Fallback",
  "round-robin": "Round robin",
  fusion: "Fusion",
};
const VISION_OFF = "__off__";

const visionValueFromAdapter = (adapter) => {
  const entry = adapter?.vision;
  if (!entry || entry.enabled === false || !Array.isArray(entry.models) || entry.models.length === 0) return VISION_OFF;
  return entry.models[0];
};

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProviders, setActiveProviders] = useState([]);
  const [comboStrategies, setComboStrategies] = useState({});
  const [capacityAdapter, setCapacityAdapter] = useState(EMPTY_CAPACITY_ADAPTER);
  const { getCaps } = useModelCaps();
  const [confirmState, setConfirmState] = useState(null);
  const notify = useNotificationStore();

  // Inline combo form (artifact C-09): always visible below the table.
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState("");
  const [formStrategy, setFormStrategy] = useState("fallback");
  const [formModels, setFormModels] = useState([]);
  const [formVision, setFormVision] = useState(VISION_OFF);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const scrollToForm = () => {
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const fetchData = async () => {
    try {
      const [combosRes, providersRes, settingsRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/providers"),
        fetch("/api/settings"),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};

      // Only LLM combos here - webSearch/webFetch combos belong to media-providers/web
      const llmCombos = combosRes.ok ? (combosData.combos || []).filter((c) => !c.kind || c.kind === "llm") : [];
      if (combosRes.ok) setCombos(llmCombos);
      if (providersRes.ok) {
        setActiveProviders((providersData.connections || []).filter((c) => c.isActive !== false));
      }
      setComboStrategies(settingsData.comboStrategies || {});
      const rawAdapter = settingsData.capacityAdapter || {};
      const normalized = {};
      for (const cap of CAPACITY_ADAPTER_CAPS) {
        normalized[cap.key] = normalizeCapEntry(rawAdapter[cap.key]);
      }
      setCapacityAdapter((prev) => ({ ...prev, ...normalized }));
      return llmCombos;
    } catch (error) {
      console.log("Error fetching data:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pruneStrategiesForNames = (names, base = comboStrategies) => {
    const updated = { ...base };
    for (const name of names) delete updated[name];
    return updated;
  };

  const persistComboStrategies = async (updated) => {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comboStrategies: updated }),
    });
    setComboStrategies(updated);
  };

  const handleDelete = async (id) => {
    const combo = combos.find((c) => c.id === id);
    setConfirmState({
      title: "Delete Combo",
      message: combo ? `Delete combo "${combo.name}"?` : "Delete this combo?",
      onConfirm: async () => {
        setConfirmState((prev) => (prev ? { ...prev, loading: true } : null));
        try {
          const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
          if (res.ok) {
            if (combo?.name) {
              await persistComboStrategies(pruneStrategiesForNames([combo.name]));
            }
            setCombos((prev) => prev.filter((c) => c.id !== id));
            if (editingId === id) resetForm();
            notify.success("Combo deleted");
          }
          setConfirmState(null);
        } catch (error) {
          console.log("Error deleting combo:", error);
          setConfirmState((prev) => (prev ? { ...prev, loading: false } : null));
        }
      },
    });
  };

  // Models list for the inline form's selects: same sources the old
  // ModelSelectModal used (connected providers + the static catalog), labelled
  // `{Provider} · {model}`. Combos themselves are valid chain members, and any
  // model already referenced by a combo stays selectable.
  const modelOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    const push = (value, label) => {
      if (value && !seen.has(value)) {
        seen.add(value);
        opts.push({ value, label });
      }
    };
    for (const combo of combos) push(combo.name, `Combo · ${combo.name}`);
    const providerIds = [...new Set(activeProviders.map((c) => c.provider || c.id).filter(Boolean))];
    for (const providerId of providerIds) {
      const alias = getProviderAlias(providerId);
      const providerName = AI_PROVIDERS[providerId]?.name || providerId;
      for (const model of getModelsByProviderId(providerId)) {
        push(`${alias}/${model.id}`, `${providerName} · ${model.id}`);
      }
    }
    for (const combo of combos) {
      for (const model of combo.models || []) push(model, model);
    }
    for (const model of formModels) push(model, model);
    return opts;
  }, [combos, activeProviders, formModels]);

  // Vision Adapter options: vision-capable models (per useModelCaps) + Off last.
  const visionOptions = useMemo(() => {
    const opts = modelOptions.filter((o) => getCaps(o.value)?.vision);
    const seen = new Set(opts.map((o) => o.value));
    const globalVision = visionValueFromAdapter(capacityAdapter);
    if (globalVision !== VISION_OFF && !seen.has(globalVision)) {
      const known = modelOptions.find((o) => o.value === globalVision);
      opts.push(known || { value: globalVision, label: globalVision });
    }
    if (formVision !== VISION_OFF && !opts.some((o) => o.value === formVision)) {
      const known = modelOptions.find((o) => o.value === formVision);
      opts.push(known || { value: formVision, label: formVision });
    }
    opts.push({ value: VISION_OFF, label: "Off" });
    return opts;
  }, [modelOptions, getCaps, capacityAdapter, formVision]);

  const resetForm = () => {
    setEditingId(null);
    setFormName("");
    setFormStrategy("fallback");
    setFormModels([]);
    setFormVision(VISION_OFF);
    setNameError("");
  };

  const loadComboIntoForm = (combo) => {
    setEditingId(combo.id);
    setFormName(combo.name || "");
    setFormStrategy(comboStrategies[combo.name]?.fallbackStrategy || "fallback");
    setFormModels([...(combo.models || [])]);
    // C-08: per-combo Vision Adapter binding (null = Off).
    setFormVision(combo.visionAdapter || VISION_OFF);
    setNameError("");
    scrollToForm();
  };

  const handleNewCombo = () => {
    resetForm();
    scrollToForm();
  };

  const validateName = (value) => {
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError("Only letters, numbers, -, _ and . allowed");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleSaveCombo = async () => {
    const name = formName.trim();
    if (!validateName(name)) return;
    const editingCombo = editingId ? combos.find((c) => c.id === editingId) : null;
    const oldName = editingCombo?.name || null;
    setSaving(true);
    try {
      // 1) Combo record — visionAdapter is per-combo (C-08): the select's
      // value travels with the combo payload; Off saves null.
      const visionAdapter = formVision === VISION_OFF ? null : formVision;
      if (editingId) {
        const res = await fetch(`/api/combos/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, models: formModels, visionAdapter }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          notify.error(err.error || "Failed to update combo");
          return;
        }
      } else {
        const res = await fetch("/api/combos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, models: formModels, visionAdapter }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          notify.error(err.error || "Failed to create combo");
          return;
        }
      }

      // 2) Strategy — stored in settings.comboStrategies[name] (merging keeps
      // an existing fusion judgeModel; a rename prunes the old name's entry).
      const updatedStrategies = { ...comboStrategies };
      if (oldName && oldName !== name) delete updatedStrategies[oldName];
      const nextStrategy = { ...(updatedStrategies[name] || {}), fallbackStrategy: formStrategy };
      if (!nextStrategy.fallbackStrategy || nextStrategy.fallbackStrategy === "fallback") {
        delete updatedStrategies[name];
      } else {
        updatedStrategies[name] = nextStrategy;
      }
      await persistComboStrategies(updatedStrategies);

      const fresh = await fetchData();
      const saved = (fresh || []).find((c) => c.name === name);
      if (saved) setEditingId(saved.id);
      notify.success("Combo saved");
    } catch (error) {
      console.log("Error saving combo:", error);
      notify.error("Failed to save combo");
    } finally {
      setSaving(false);
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

  const strategyOf = (combo) => comboStrategies[combo.name]?.fallbackStrategy || "fallback";
  const judgeOf = (combo) => comboStrategies[combo.name]?.judgeModel || "";

  return (
    <div className="flex min-w-0 flex-col">
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Combo &amp; Vision Adapter</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Create model combos with fallback support: one model name that walks a chain of providers until one answers.</p>
      </div>

      {/* Combos table */}
      <Card padding="none">
        <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
          <h3 className="text-[13.5px] font-semibold">Combos</h3>
          <div className="flex-1" />
          <Button variant="primary" size="sm" onClick={handleNewCombo}>+ New combo</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap">Combo</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap">Chain</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap">Strategy</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap">Status</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {combos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3.5 py-2.5 border-b border-border align-middle">
                    <span className="text-xs text-text-muted">No combos yet — create one with + New combo.</span>
                  </td>
                </tr>
              ) : (
                combos.map((combo) => {
                  const strategy = strategyOf(combo);
                  const isFusion = strategy === "fusion";
                  const judge = judgeOf(combo);
                  const hint = combo.hint || combo.description || "";
                  return (
                    <tr key={combo.id}>
                      <td className="px-3.5 py-2.5 border-b border-border align-middle">
                        <b className="font-mono text-[12.5px] font-semibold">{combo.name}</b>
                        {hint && <div className="text-xs text-text-muted">{hint}</div>}
                      </td>
                      <td className="px-3.5 py-2.5 border-b border-border align-middle">
                        {(combo.models || []).length === 0 ? (
                          <span className="text-xs text-text-muted">No models</span>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                            {(combo.models || []).map((model, index) => (
                              <Fragment key={`${model}-${index}`}>
                                {index > 0 && <span className="text-text-subtle">{isFusion ? "+" : "→"}</span>}
                                <span className="border border-border-strong bg-surface-2 rounded-md px-2.5 py-[5px]">{model}</span>
                              </Fragment>
                            ))}
                            {isFusion && judge && (
                              <>
                                <span className="text-text-subtle">→</span>
                                <span className="border border-border-strong bg-surface-2 rounded-md px-2.5 py-[5px]">judge: {judge}</span>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 border-b border-border align-middle">{STRATEGY_TEXT[strategy] || "Fallback"}</td>
                      {/* C-07: last observed request outcome for this combo
                          (combo.lastOutcome from the combos table). */}
                      <td className="px-3.5 py-2.5 border-b border-border align-middle">
                        {combo.lastOutcome ? (
                          combo.lastOutcome.status === "ok" ? (
                            <span className="font-mono text-[11.5px] font-semibold">
                              ok{combo.lastOutcome.model ? ` · ${combo.lastOutcome.model}` : ""}{combo.lastOutcome.at ? ` · ${new Date(combo.lastOutcome.at).toLocaleTimeString("en-GB")}` : ""}
                            </span>
                          ) : (
                            <span className="font-mono text-[11.5px] font-semibold underline underline-offset-[3px]">
                              {combo.lastOutcome.error || combo.lastOutcome.status || "error"}
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 border-b border-border align-middle">
                        <Button variant="ghost" size="sm" onClick={() => loadComboIntoForm(combo)}>Edit</Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inline combo form */}
      <div ref={formRef} className="mt-3.5 scroll-mt-5">
        <Card padding="none">
          <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
            <h3 className="text-[13.5px] font-semibold">{editingId ? `Edit combo — ${formName}` : "New combo"}</h3>
          </div>
          <div className="px-[18px] py-4">
            <div className="grid grid-cols-1 min-[821px]:grid-cols-2 gap-3.5">
              <Input
                label="Combo name"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (e.target.value) validateName(e.target.value);
                  else setNameError("");
                }}
                placeholder="my-combo"
                error={nameError}
                inputClassName="font-mono"
              />
              <Select
                label="Strategy"
                options={STRATEGY_OPTIONS}
                value={formStrategy}
                onChange={(e) => setFormStrategy(e.target.value)}
              />
            </div>

            <label className="block text-[12.5px] font-semibold mb-1.5 mt-3.5">Models in order</label>
            <div className="flex flex-col gap-2">
              {formModels.map((model, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="font-mono text-text-subtle w-[18px] shrink-0">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Select
                      options={modelOptions}
                      value={model}
                      onChange={(e) => {
                        const next = [...formModels];
                        next[index] = e.target.value;
                        setFormModels(next);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormModels(formModels.filter((_, i) => i !== index))}
                    className="w-[30px] h-[30px] shrink-0 border border-border-strong rounded-md flex items-center justify-center text-text-muted hover:bg-surface-2"
                    aria-label={`Remove step ${index + 1}`}
                  >
                    <SpecIcon size={14}>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </SpecIcon>
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={modelOptions.length === 0}
                onClick={() => modelOptions[0] && setFormModels([...formModels, modelOptions[0].value])}
              >
                + Add model
              </Button>
            </div>

            <div className="h-px bg-border my-[18px]" />

            <div className="flex items-center gap-3.5 py-[13px] pt-0">
              <div className="flex-1 min-w-0">
                <b className="block text-[13.5px] font-semibold">Vision Adapter</b>
                <span className="text-[12.5px] text-text-muted">Route image inputs in this combo to a vision-capable model automatically</span>
              </div>
              <div className="w-full max-w-[260px] shrink-0">
                <Select options={visionOptions} value={formVision} onChange={(e) => setFormVision(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap mt-3.5">
              <Button variant="primary" onClick={handleSaveCombo} loading={saving} disabled={!formName.trim() || !!nameError}>
                Save combo
              </Button>
              {editingId && (
                <Button variant="secondary" onClick={() => handleDelete(editingId)}>
                  Delete
                </Button>
              )}
              <span className="text-xs text-text-muted">Sticky limit: keep a session on one account for up to 20 requests before rotating.</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Confirm (delete) */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => !confirmState?.loading && setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText || "Confirm"}
        variant={confirmState?.variant || "danger"}
        loading={!!confirmState?.loading}
      />
    </div>
  );
}
