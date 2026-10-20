"use client";

import { cn } from "@/shared/utils/cn";

/* Monochrome status: meaning is carried by the label; solid = affirmative,
   outlined = error/attention, tinted = neutral. */
const variants = {
  default: "bg-surface-2 text-text-muted",
  primary: "bg-brand-500 text-on-brand",
  success: "bg-brand-500 text-on-brand",
  warning: "bg-surface-2 text-text-muted border border-border",
  error: "bg-surface text-text-main border border-text-main",
  info: "bg-surface-2 text-text-muted",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
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
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            /* error = hollow dot (shape carries the meaning, not color) */
            variant === "error" && "bg-transparent border-[1.5px] border-current"
          )}
        />
      )}
      {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
      {children}
    </span>
  );
}
