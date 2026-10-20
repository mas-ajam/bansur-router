"use client";

import { Card, Badge } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  SKILLS,
  SKILLS_REPO_URL,
  getSkillRawUrl,
  getSkillBlobUrl,
} from "@/shared/constants/skills";

function CopyButton({ value, label = "Copy link" }) {
  const { copied, copy } = useCopyToClipboard(2000);
  return (
    <button
      onClick={() => copy(value)}
      className="px-2.5 py-1 rounded-md border border-border bg-surface text-[12px] font-medium text-text-main hover:bg-surface-2 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
      title={value}
    >
      <span className="material-symbols-outlined text-[13px]">
        {copied ? "check" : "content_copy"}
      </span>
      {copied ? "Copied!" : label}
    </button>
  );
}

function SkillRow({ skill }) {
  const url = getSkillRawUrl(skill.id);
  return (
    <div
      className={`flex flex-col gap-2.5 p-4 rounded-brand border shadow-[var(--shadow-soft)] transition-colors ${
        skill.isEntry
          ? "border-border-strong bg-surface-2/60"
          : "border-border bg-surface hover:bg-surface-2/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`size-[38px] rounded-md border flex items-center justify-center shrink-0 ${
            skill.isEntry
              ? "bg-brand-500 text-on-brand border-brand-500"
              : "bg-surface-2 text-text-main border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[19px]">{skill.icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-text-main">{skill.name}</h3>
            {skill.isEntry && (
              <Badge variant="primary" size="sm">START HERE</Badge>
            )}
            {skill.endpoint && (
              <Badge variant="default" size="sm">
                <code className="text-[10px]">{skill.endpoint}</code>
              </Badge>
            )}
          </div>
          <p className="text-xs leading-relaxed text-text-muted mt-0.5">{skill.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={getSkillBlobUrl(skill.id)}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-muted hover:text-text-main inline-flex items-center gap-1"
        >
          <span className="truncate">{url}</span>
          <span className="material-symbols-outlined text-[12px] shrink-0">open_in_new</span>
        </a>
        <CopyButton value={url} />
      </div>
    </div>
  );
}

export default function SkillsPage() {
  return (
    <div className="flex flex-col gap-3.5">
      {/* Page head */}
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Skills</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Reusable instruction packs your agent loads on demand — image generation, web search, documents and more, all routed through the gateway.</p>
      </div>

      <Card padding="md">
        <div className="text-xs text-text-muted mb-2">Paste this to your AI:</div>
        <div className="px-3 py-2 rounded-md border border-border bg-surface-2 font-mono text-[12px] text-text-main">
          Read this skill and use it: {getSkillRawUrl("bansur-router")}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {SKILLS.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
        ))}
      </div>

      <Card padding="md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[13.5px] font-semibold text-text-main">More on GitHub</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Browse source, README, and examples.
            </p>
          </div>
          <a
            href={`${SKILLS_REPO_URL}/tree/master/skills`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-text-main hover:underline inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            View on GitHub
          </a>
        </div>
      </Card>
    </div>
  );
}
