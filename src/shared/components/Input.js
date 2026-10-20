"use client";

import { cn } from "@/shared/utils/cn";

export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  className,
  inputClassName,
  ...props
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {label && (
        <label className="text-[12.5px] font-semibold text-text-main mb-1.5">
          {label}
          {required && <span className="text-text-main font-bold ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "w-full px-[11px] py-2 text-sm text-text-main bg-surface rounded-md",
            "border border-border-strong placeholder-text-muted/70",
            "focus:outline-none focus:border-brand-500 focus:shadow-[var(--shadow-focus)]",
            "transition-[border-color,box-shadow] duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed",
            icon && "pl-10",
            error && "border-text-main",
            inputClassName
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-text-main font-medium flex items-center gap-1 mt-1.5">
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
