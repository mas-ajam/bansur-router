"use client";

import { useState, useEffect } from "react";
import { Card, Button, Toggle } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { SKILLS } from "@/shared/constants/skills";

/* Skills (audit SK-01, SK-02; SK-03/SK-04 flagged).
   SKILLS constants carry {id, name, description, icon, endpoint} — no
   category, no version, no enabled state (SK-03-C). Card meta therefore
   falls back to the skill's endpoint path in mono, and the toggle is a
   localStorage-backed client preference (default all on), not backend
   skill-pack state. The removed "Paste this to your AI:" and "More on
   GitHub" cards (§II.24 / SK-04) are why endpoints appear as card meta. */

const STORAGE_KEY = "bansur-router:skills-enabled";

function skillGlyph(skill) {
  const words = (skill.name || skill.id || "?").split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || "?").slice(0, 2).toUpperCase();
}

function loadEnabledMap() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function SkillsPage() {
  const notify = useNotificationStore();
  const [enabledMap, setEnabledMap] = useState({});

  useEffect(() => {
    setEnabledMap(loadEnabledMap());
  }, []);

  const toggleSkill = (id, next) => {
    setEnabledMap((prev) => {
      const map = { ...prev, [id]: next };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      } catch { /* ignore */ }
      return map;
    });
  };

  return (
    <div>
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Skills</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Reusable instruction packs the router can inject into requests for tools that support them.</p>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-3">
        {SKILLS.map((skill) => {
          const enabled = enabledMap[skill.id] !== false;
          return (
            <Card key={skill.id} padding="none" className="p-4 flex flex-col gap-3 h-full">
              <div className="flex items-start gap-3">
                <div className="w-[38px] h-[38px] shrink-0 border border-border-strong rounded-md bg-surface-2 flex items-center justify-center font-mono text-[13px] font-semibold">
                  {skillGlyph(skill)}
                </div>
                <div className="grow min-w-0">
                  <div className="font-semibold text-sm leading-[1.25]">{skill.name}</div>
                  {skill.endpoint ? (
                    <div className="text-xs text-text-muted font-mono">{skill.endpoint}</div>
                  ) : (
                    <div className="text-xs text-text-muted">Entry point</div>
                  )}
                </div>
                <Toggle checked={enabled} onChange={(v) => toggleSkill(skill.id, v)} />
              </div>
              <div className="text-xs text-text-muted">{skill.description}</div>
            </Card>
          );
        })}

        {/* Add skill — no import mechanism exists in this build (SK-04-C) */}
        <Card padding="none" className="p-4 flex flex-col gap-3 h-full border-dashed items-start justify-center">
          <div className="font-semibold text-sm leading-[1.25]">+ Add skill</div>
          <div className="text-xs text-text-muted">
            Drop a skill folder into <span className="font-mono">~/.bansur-router/skills</span> or import from a Git URL.
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => notify.error("Skill import is not available in this build")}
          >
            Import
          </Button>
        </Card>
      </div>
    </div>
  );
}
