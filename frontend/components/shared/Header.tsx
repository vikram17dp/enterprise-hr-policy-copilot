import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned action area (buttons, filters, etc.). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard page header used at the top of every employee page.
 * Provides consistent typography, hierarchy, and an optional action slot.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export default PageHeader;
