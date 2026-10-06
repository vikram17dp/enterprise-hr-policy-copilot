import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

type Accent = "blue" | "emerald" | "amber" | "violet" | "rose" | "slate";

const accentMap: Record<Accent, string> = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: Accent;
  hint?: string;
  className?: string;
}

/**
 * Compact KPI card for the admin overview. Clear visual hierarchy: an icon
 * chip, a large value, a label, and an optional hint.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = "blue",
  hint,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-slate-500">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-slate-400">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              accentMap[accent]
            )}
            aria-hidden
          >
            <Icon className="size-[18px]" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-full space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="size-9 rounded-lg" />
      </div>
    </div>
  );
}

export default MetricCard;
