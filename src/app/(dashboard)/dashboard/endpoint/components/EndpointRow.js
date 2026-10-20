"use client";

import { Input } from "@/shared/components";

/** Reusable endpoint row component */
export default function EndpointRow({ label, url, copyId, copied, onCopy, badge, actions }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface-2 px-3 py-2">
      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border shrink-0 min-w-[76px] text-center ${
          (badge === "CF" || badge === "TS") ? "border-text-main text-text-main" : "border-border text-text-muted"
        }`}>{label}</span>
      <Input value={url} readOnly className="flex-1 font-mono text-[13px]" inputClassName="bg-transparent border-transparent px-0 py-1 focus:ring-0 focus:border-transparent" />
      <button
        onClick={() => onCopy(url, copyId)}
        className="h-[30px] px-2.5 rounded-md border border-border bg-surface text-[12.5px] font-medium text-text-main hover:bg-surface-2 transition-colors shrink-0 flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-[14px]">{copied === copyId ? "check" : "content_copy"}</span>
        {copied === copyId ? "Copied" : "Copy"}
      </button>
      {actions}
    </div>
  );
}
