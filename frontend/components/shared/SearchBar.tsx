"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Reusable search input with a leading icon and a clear button.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className,
  "aria-label": ariaLabel = "Search",
}: SearchBarProps) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        type="search"
        role="searchbox"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/15"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export default SearchBar;
