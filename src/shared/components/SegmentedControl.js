"use client";

import { cn } from "@/shared/utils/cn";

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  className,
}) {
  const sizes = {
    sm: "h-7 text-xs",
    md: "h-8 text-[12.5px]",
    lg: "h-10 text-sm",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-surface overflow-x-auto",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "shrink-0 px-[13px] font-medium transition-all border-r border-border last:border-r-0",
            sizes[size],
            value === option.value
              ? "bg-brand-500 text-on-brand"
              : "text-text-muted hover:text-text-main"
          )}
        >
          {option.icon && (
            <span className="material-symbols-outlined text-[16px] mr-1.5">
              {option.icon}
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
