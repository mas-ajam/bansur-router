"use client";

import { cn } from "@/shared/utils/cn";

/* Artifact select chevron: 10×6 stroke SVG (#5d666e via currentColor) */
function Chevron() {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  error,
  hint,
  disabled = false,
  required = false,
  className,
  selectClassName,
  ...props
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {label && (
        <label className="text-[12.5px] font-semibold text-text-main mb-1.5">
          {label}
          {required && <span className="text-text-main ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "w-full py-2 pl-[11px] pr-7 text-sm text-text-main",
            "bg-surface border border-border-strong rounded-md appearance-none",
            "focus:outline-none focus:border-brand-500 focus:shadow-[var(--shadow-focus)]",
            "transition-[border-color,box-shadow] duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-text-main",
            selectClassName
          )}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-[10px] pointer-events-none text-text-muted">
          <Chevron />
        </div>
      </div>
      {error && (
        <p className="text-xs text-text-main flex items-center gap-1 mt-1.5">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-text-muted mt-1.5">{hint}</p>
      )}
    </div>
  );
}
