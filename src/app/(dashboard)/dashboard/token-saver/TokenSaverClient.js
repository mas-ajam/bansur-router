"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Badge, Toggle } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

// Token Saver (audit §II.9, TS-01..TS-05) — rebuilt to the artifact in
// Phase 4. Layout: toggles card | "Compression today" card, then the
// "Saved by output type" table. The legacy stacked sections (Caveman,
// Ponytail, PXPIPE crosslink, Headroom proxy management) were
// artifact-undefined surfaces and are removed per §II.24; the
// headroomEnabled setting still drives the chat pipeline itself.
// Stats come from the Phase 4 telemetry endpoint
// (GET /api/token-saver/stats), recorded in-process at the RTK stage.

const fmt = (n) => new Intl.NumberFormat("en-US").format(n || 0);

// Artifact display names per RTK filter id; ls + find share one row.
const TYPE_LABELS = {
  "git-diff": "git diff",
  "git-status": "git status",
  "git-log": "git log",
  grep: "grep / rg",
  find: "ls / find",
  ls: "ls / find",
  tree: "tree",
  "dedup-log": "dedup log",
  "smart-truncate": "smart truncate",
  "read-numbered": "read (numbered)",
  "search-list": "search list",
  "build-output": "test runners",
};

const thClass =
  "text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-subtle px-3.5 py-[9px] border-b border-border whitespace-nowrap";
const thNumClass = `${thClass} text-right font-mono text-[12.5px]`;
const tdClass = "px-3.5 py-2.5 border-b border-border align-middle";
const tdNumClass = `${tdClass} text-right font-mono text-[12.5px]`;

function SettingRow({ title, description, checked, onChange, disabled, first = false }) {
  return (
    <div
      className={`flex items-center gap-3.5 ${
        first ? "pt-[2px] pb-[13px]" : "py-[13px]"
      } border-b border-border last:border-b-0 last:pb-0`}
    >
      <div className="flex-1 min-w-0">
        <b className="block text-[13.5px] font-semibold">{title}</b>
        <span className="text-[12.5px] text-text-muted">{description}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function TokenSaverClient() {
  const notify = useNotificationStore();
  const [toggles, setToggles] = useState(null);
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const s = data.settings || data;
        setToggles({
          rtkEnabled: s.rtkEnabled !== false,
          headroomEnabled: s.headroomEnabled === true,
          rtkAggressive: s.rtkAggressive === true,
        });
      })
      .catch(() => {
        if (!cancelled) setToggles({ rtkEnabled: true, headroomEnabled: false, rtkAggressive: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/token-saver/stats");
      if (!res.ok) return;
      const data = await res.json();
      setToday(data?.rtk?.today || null);
    } catch {
      // Keep the last good stats on a failed poll.
    }
  }, []);

  useEffect(() => {
    loadStats();
    const timer = setInterval(loadStats, 15000);
    return () => clearInterval(timer);
  }, [loadStats]);

  const handleToggle = async (key, value) => {
    const prev = toggles;
    setToggles({ ...toggles, [key]: value });
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setToggles(prev);
      notify.error("Failed to save Token Saver settings");
    } finally {
      setSaving(false);
    }
  };

  const tokensIn = today?.tokensIn || 0;
  const tokensOut = today?.tokensOut || 0;
  const savedPct = tokensIn > 0 ? ((tokensIn - tokensOut) / tokensIn) * 100 : 0;
  const savedPctLabel = `${savedPct.toFixed(1)}% saved`;

  const typeRows = (() => {
    const byType = today?.byType || {};
    const merged = new Map();
    for (const [filter, t] of Object.entries(byType)) {
      const label = TYPE_LABELS[filter] || filter;
      const row = merged.get(label) || { label, calls: 0, tokensIn: 0, tokensOut: 0 };
      row.calls += t.calls || 0;
      row.tokensIn += t.tokensIn || 0;
      row.tokensOut += t.tokensOut || 0;
      merged.set(label, row);
    }
    return [...merged.values()].sort((a, b) => b.tokensIn - a.tokensIn);
  })();

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Token Saver</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">
          Compress tool output before it reaches the model, and trim oversized context — same
          answers, fewer tokens burned.
        </p>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2">
        <Card>
          <SettingRow
            first
            title="RTK — tool output compression"
            description="Rewrites verbose command output (git, grep, ls, test runs) into compact summaries before it enters the context."
            checked={!!toggles?.rtkEnabled}
            disabled={!toggles || saving}
            onChange={(v) => handleToggle("rtkEnabled", v)}
          />
          <SettingRow
            title="Headroom — context compression"
            description="Trims and summarizes long conversation context when a request approaches the model window."
            checked={!!toggles?.headroomEnabled}
            disabled={!toggles || saving}
            onChange={(v) => handleToggle("headroomEnabled", v)}
          />
          <SettingRow
            title="Aggressive mode"
            description="Stronger compression for shell output; may drop low-signal lines."
            checked={!!toggles?.rtkAggressive}
            disabled={!toggles || saving}
            onChange={(v) => handleToggle("rtkAggressive", v)}
          />
        </Card>

        <Card>
          <h3 className="text-[13.5px] font-semibold mb-4">Compression today</h3>
          <div className="flex items-baseline gap-[18px]">
            <div>
              <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">
                {today ? fmt(tokensIn) : "—"}
              </div>
              <div className="text-xs text-text-muted mt-[3px]">tokens in</div>
            </div>
            <div className="text-[20px] text-text-subtle">→</div>
            <div>
              <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">
                {today ? fmt(tokensOut) : "—"}
              </div>
              <div className="text-xs text-text-muted mt-[3px]">tokens out</div>
            </div>
            <span className="ml-auto">
              <Badge variant="primary">{today ? savedPctLabel : "—"}</Badge>
            </span>
          </div>
          <div className="h-[6px] rounded-full bg-[#e7eaec] overflow-hidden mt-3.5">
            <span
              className="block h-full rounded-full bg-brand-500"
              style={{ width: `${Math.max(0, Math.min(100, savedPct))}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mt-3.5">
            Typical savings land between 20–40% depending on how shell-heavy the session is.
          </p>
        </Card>
      </div>

      <Card padding="none" className="mt-3.5">
        <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
          <h3 className="text-[13.5px] font-semibold">Saved by output type</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th className={thClass}>Tool output</th>
                <th className={thNumClass}>Calls</th>
                <th className={thNumClass}>Tokens in</th>
                <th className={thNumClass}>Tokens out</th>
                <th className={thClass} style={{ width: "22%" }}>
                  Saved
                </th>
              </tr>
            </thead>
            <tbody>
              {typeRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tdClass} text-xs text-text-muted`}>
                    No tool output compressed yet today
                  </td>
                </tr>
              ) : (
                typeRows.map((row) => {
                  const pct =
                    row.tokensIn > 0
                      ? Math.round(((row.tokensIn - row.tokensOut) / row.tokensIn) * 100)
                      : 0;
                  return (
                    <tr key={row.label}>
                      <td className={`${tdClass} font-mono text-[12.5px]`}>{row.label}</td>
                      <td className={tdNumClass}>{fmt(row.calls)}</td>
                      <td className={tdNumClass}>{fmt(row.tokensIn)}</td>
                      <td className={tdNumClass}>{fmt(row.tokensOut)}</td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-2.5">
                          <div className="h-[4px] flex-1 rounded-full bg-[#e7eaec] overflow-hidden">
                            <span
                              className="block h-full rounded-full bg-brand-500"
                              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[12px]">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-[18px] py-2.5 text-xs text-text-muted border-t border-border">
          * Passing runs compress heavily; failing runs keep full output so the model sees the
          error.
        </div>
      </Card>
    </div>
  );
}
