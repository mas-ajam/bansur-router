"use client";

import Link from "next/link";
import { Card } from "@/shared/components";
import Image from "next/image";

/**
 * Clickable card for MITM tools — navigates to /dashboard/mitm on click.
 */
export default function MitmLinkCard({ tool }) {
  return (
    <Link href="/dashboard/mitm" className="block">
      <Card padding="md" className="overflow-hidden hover:border-border-strong transition-colors cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-[38px] rounded-md border border-border bg-surface-2 flex items-center justify-center shrink-0 overflow-hidden">
              <Image
                src={tool.image}
                alt={tool.name}
                width={32}
                height={32}
                className="size-6 object-contain"
                sizes="32px"
                onError={(e) => { e.target.style.display = "none"; }}
              loading="lazy"
              decoding="async"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{tool.name}</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-surface-2 text-text-muted dark:text-text-muted rounded-full">MITM</span>
              </div>
              <p className="text-xs text-text-muted truncate">{tool.description}</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-text-muted text-[20px]">chevron_right</span>
        </div>
      </Card>
    </Link>
  );
}
