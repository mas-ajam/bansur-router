"use client";

import { cn } from "@/shared/utils/cn";

/* Artifact .tag: 11px/600 uppercase, letter-spacing .04em, padding 2px 8px,
   panel bg + line-2 border + muted text. .solid = ink fill; .err = ink border/text.
   Status meaning is carried by the label, never by hue. */
const variants = {
  default: "bg-surface text-text-muted border-border-strong",
  primary: "bg-brand-500 border-brand-500 text-on-brand",
  success: "bg-brand-500 border-brand-500 text-on-brand",
  warning: "bg-surface text-text-muted border-border-strong",
  error: "bg-surface text-text-main border-text-main",
  info: "bg-surface text-text-muted border-border-strong",
};

const sizes = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2 py-0.5 text-[11px]",
  lg: "px-2.5 py-1 text-xs",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] rounded-full font-semibold uppercase tracking-[0.04em] border",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-2 rounded-full bg-current shrink-0",
            /* error = hollow dot (shape carries the meaning, not color) */
            variant === "error" && "bg-transparent border-[1.5px] border-current"
          )}
        />
      )}
      {icon && <span className="material-symbols-outlined text-[14px] normal-case tracking-normal">{icon}</span>}
      {children}
    </span>
  );
}
