"use client";

import {
  Bookmark,
  FileText,
  History,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import type { EmployeeStats as EmployeeStatsData } from "@/types/user";

interface EmployeeStatsProps {
  stats: EmployeeStatsData | null;
  loading: boolean;
}

interface StatConfig {
  key: keyof EmployeeStatsData;
  label: string;
  icon: LucideIcon;
  iconClass: string;
}

const STATS: StatConfig[] = [
  {
    key: "questionsAsked",
    label: "Questions Asked",
    icon: MessageSquareText,
    iconClass: "bg-blue-50 text-blue-600",
  },
  {
    key: "savedAnswers",
    label: "Saved Answers",
    icon: Bookmark,
    iconClass: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "conversations",
    label: "Conversations",
    icon: History,
    iconClass: "bg-violet-50 text-violet-600",
  },
  {
    key: "documentsAvailable",
    label: "Documents Available",
    icon: FileText,
    iconClass: "bg-amber-50 text-amber-600",
  },
];

/**
 * Small statistic cards for the dashboard. Shows skeletons while loading.
 */
export function EmployeeStats({ stats, loading }: EmployeeStatsProps) {
  return (
    <section
      aria-label="Your activity"
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
    >
      {STATS.map((stat) => {
        const Icon = stat.icon;
        const value = stats ? stats[stat.key] : undefined;

        return (
          <div
            key={stat.key}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
          >
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                stat.iconClass
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
            </div>

            {loading || value === undefined ? (
              <>
                <Skeleton className="mt-4 h-7 w-12" />
                <Skeleton className="mt-2 h-3 w-24" />
              </>
            ) : (
              <>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {value}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500 sm:text-[13px]">
                  {stat.label}
                </p>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

export default EmployeeStats;
