"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  label?: string;
  placeholder?: string;
  className?: string;
  /** Forwarded to the <select> so a <Label htmlFor> can associate with it. */
  id?: string;
  "aria-label"?: string;
}

/**
 * Native, styled <select> used for list filters (status, category, role, date
 * range). A native control is deliberately used instead of the Base UI Select
 * primitive: it is fully keyboard/screen-reader accessible out of the box,
 * has no portal/focus quirks, and matches the compact filter-bar styling.
 */
export function FilterSelect({
  value,
  onChange,
  options,
  label,
  placeholder = "All",
  className,
  id,
  "aria-label": ariaLabel,
}: FilterSelectProps) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      {label ? (
        <span className="sr-only">{label}</span>
      ) : null}
      <select
        id={id}
        value={value}
        aria-label={ariaLabel ?? label ?? "Filter"}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/15"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 size-4 text-slate-400"
        aria-hidden
      />
    </label>
  );
}

export default FilterSelect;
