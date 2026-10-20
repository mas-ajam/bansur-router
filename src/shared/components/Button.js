"use client";

import { cn } from "@/shared/utils/cn";

/* Artifact .btn: default = panel bg + line-2 border; primary/danger = solid ink;
   ghost = transparent border, ink text. No shadow, no scale transform. */
const variants = {
  primary: "bg-brand-500 border-brand-500 hover:bg-brand-600 hover:border-brand-600 text-on-brand",
  secondary: "bg-surface border-border-strong text-text-main hover:bg-surface-2 hover:border-[#b9c0c6]",
  outline: "bg-transparent border-border-strong text-text-main hover:bg-surface-2 hover:border-[#b9c0c6]",
  ghost: "bg-transparent border-transparent text-text-main hover:bg-[#eef0f1]",
  danger: "bg-brand-500 border-brand-500 hover:bg-brand-600 hover:border-brand-600 text-on-brand",
  success: "bg-brand-500 border-brand-500 hover:bg-brand-600 hover:border-brand-600 text-on-brand",
};

const sizes = {
  xs: "h-6 px-2.5 text-[11px] rounded-md gap-1.5",
  sm: "px-2.5 py-1 text-[12.5px] rounded-md",
  md: "px-[13px] py-[7px] text-[13px] rounded-md",
  lg: "px-5 py-2.5 text-sm rounded-md",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-[7px] font-medium whitespace-nowrap border transition-[background-color,border-color] duration-150 ease-out cursor-pointer",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={cn("material-symbols-outlined animate-spin", size === "xs" ? "text-[14px]" : "text-[18px]")}>progress_activity</span>
      ) : icon ? (
        <span className={cn("material-symbols-outlined", size === "xs" ? "text-[14px]" : "text-[18px]")}>{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className={cn("material-symbols-outlined", size === "xs" ? "text-[14px]" : "text-[18px]")}>{iconRight}</span>
      )}
    </button>
  );
}
