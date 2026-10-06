"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface SectionCardProps {
  title?: string;
  description?: string;
  /** Right-aligned header actions (buttons, selects, links). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Removes the default body padding (useful for tables that bleed to edges). */
  bodyClassName?: string;
}

/**
 * Standard white content card with an optional titled header and action slot.
 * Used to group related panels across the admin overview, reports, and
 * settings pages for a consistent visual rhythm.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      {title || action ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export default SectionCard;
