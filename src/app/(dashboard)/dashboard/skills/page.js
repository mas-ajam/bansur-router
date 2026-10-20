"use client";

import { useState, useEffect } from "react";
import { Card, Button, Toggle, Input } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

/* Skills (audit SK-01..SK-04; SK-03/SK-04 resolved in Phase 4).
   The list comes from GET /api/skills: built-in SKILLS constants merged
   with imported packs from DATA_DIR/skills, each entry carrying
   {category, version, enabled, source}. Enabled state persists
   server-side (settings.skillStates) via PATCH /api/skills; the dashed
   card imports a pack from a Git URL via POST /api/skills/import.
   Category/version render "—" when the pack carries none. */

function skillGlyph(skill) {
  const words = (skill.name || skill.id || "?").split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || "?").slice(0, 2).toUpperCase();
}

function skillMeta(skill) {
  const parts = [];
  if (skill.category) parts.push(skill.category);
  if (skill.version) parts.push(`v${skill.version}`);
  return parts.length ? parts.join(" · ") : "—";
}

export default function SkillsPage() {
  const notify = useNotificationStore();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/skills", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setSkills(data.skills || []);
        else notify.error(data.error || "Failed to load skills");
      } catch {
        notify.error("Failed to load skills");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSkill = async (id, next) => {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: next } : s)));
    try {
      const res = await fetch("/api/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update skill");
      }
    } catch (error) {
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !next } : s)));
      notify.error(error.message || "Failed to update skill");
    }
  };

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify.error(data.error || "Skill import failed");
        return;
      }
      setSkills((prev) => (prev.some((s) => s.id === data.id) ? prev : [...prev, data]));
      setImportUrl("");
      notify.success(`Skill imported: ${data.name || data.id}`);
    } catch {
      notify.error("Skill import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Skills</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Reusable instruction packs the router can inject into requests for tools that support them.</p>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-3">
        {skills.map((skill) => {
          const enabled = skill.enabled !== false;
          return (
            <Card key={skill.id} padding="none" className="p-4 flex flex-col gap-3 h-full">
              <div className="flex items-start gap-3">
                <div className="w-[38px] h-[38px] shrink-0 border border-border-strong rounded-md bg-surface-2 flex items-center justify-center font-mono text-[13px] font-semibold">
                  {skillGlyph(skill)}
                </div>
                <div className="grow min-w-0">
                  <div className="font-semibold text-sm leading-[1.25]">{skill.name}</div>
                  <div className="text-xs text-text-muted">{skillMeta(skill)}</div>
                </div>
                <Toggle checked={enabled} onChange={(v) => toggleSkill(skill.id, v)} />
              </div>
              <div className="text-xs text-text-muted">{skill.description || "—"}</div>
            </Card>
          );
        })}

        {/* Add skill — import from a Git URL (SK-04) */}
        <Card padding="none" className="p-4 flex flex-col gap-3 h-full border-dashed items-start justify-center">
          <div className="font-semibold text-sm leading-[1.25]">+ Add skill</div>
          <div className="text-xs text-text-muted">
            Drop a skill folder into <span className="font-mono">~/.bansur-router/skills</span> or import from a Git URL.
          </div>
          <div className="flex w-full items-center gap-2">
            <Input
              placeholder="https://github.com/…/skill.git"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              disabled={importing || loading}
              aria-label="Skill Git URL"
              className="grow"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleImport}
              loading={importing}
              disabled={!importUrl.trim() || loading}
            >
              Import
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
