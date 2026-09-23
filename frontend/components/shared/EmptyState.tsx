import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Consistent empty state for lists (conversations, saved answers, documents).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100">
          <Icon className="size-6 text-slate-400" aria-hidden />
        </div>
      ) : null}

      <h3 className="text-base font-semibold text-slate-900">{title}</h3>

      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
          {description}
        </p>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          type="button"
          onClick={onAction}
          className="mt-5 h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export default EmptyState;
