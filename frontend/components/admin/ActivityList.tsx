"use client";

import { cn } from "@/lib/utils/cn";
import { formatRelativeTime } from "@/lib/utils/formatDate";

export interface ActivityItem {
  id: string;
  /** Primary text, e.g. "Uploaded policy KB-01". */
  title: string;
  /** Secondary text, e.g. actor email or resource. */
  meta?: string | null;
  /** ISO timestamp rendered as a relative time. */
  at: string;
}

interface ActivityListProps {
  items: ActivityItem[];
  emptyLabel?: string;
  className?: string;
}

/**
 * Compact vertical timeline for "recent activity" panels. Renders a dot, a
 * title, optional meta, and a relative timestamp. Purely presentational —
 * parents map their data into ActivityItem[].
 */
export function ActivityList({
  items,
  emptyLabel = "No recent activity",
  className,
}: ActivityListProps) {
  if (!items.length) {
    return (
      <p className={cn("py-8 text-center text-sm text-slate-400", className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ol className={cn("relative space-y-4", className)}>
      <span
        className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-slate-200"
        aria-hidden
      />
      {items.map((item) => (
        <li key={item.id} className="relative flex gap-3 pl-0">
          <span
            className="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white bg-indigo-500 shadow"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">
              {item.title}
            </p>
            {item.meta ? (
              <p className="truncate text-xs text-slate-500">{item.meta}</p>
            ) : null}
          </div>
          <time
            dateTime={item.at}
            className="shrink-0 text-xs text-slate-400 tabular-nums"
          >
            {formatRelativeTime(item.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

export default ActivityList;
