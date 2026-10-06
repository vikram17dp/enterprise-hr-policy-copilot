"use client";

import Link from "next/link";
import {
  ArrowRight,
  Files,
  MessagesSquare,
  Users,
  CheckCircle2,
  Clock,
  Inbox,
} from "lucide-react";

import { useApi } from "@/hooks/useApi";
import { getAdminDashboard } from "@/lib/api/admin";
import { PageHeader } from "@/components/shared/Header";
import { ErrorState } from "@/components/shared/ErrorState";
import { MetricCard, MetricCardSkeleton } from "@/components/admin/MetricCard";
import { SectionCard } from "@/components/admin/SectionCard";
import { ActivityList, type ActivityItem } from "@/components/admin/ActivityList";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  LineChart,
  DonutChart,
  RankList,
  type Point,
  type Slice,
} from "@/components/admin/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils/formatDate";
import type { QueryStatus } from "@/types/admin";

const STATUS_COLORS: Record<QueryStatus, string> = {
  open: "#f59e0b",
  in_progress: "#2563eb",
  resolved: "#10b981",
  closed: "#94a3b8",
};

const STATUS_LABELS: Record<QueryStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

/** Humanize a dotted audit action, e.g. "policy.uploaded" → "Policy uploaded". */
function humanizeAction(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function OverviewView() {
  const { data, loading, error, refetch } = useApi(getAdminDashboard, []);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="System overview, key metrics, and recent activity."
        />
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  const m = data?.metrics;

  const trend: Point[] = (data?.queriesOverTime ?? []).map((d) => ({
    label: d.date.slice(5), // MM-DD
    value: d.count,
  }));

  const statusSlices: Slice[] = (data?.queriesByStatus ?? [])
    .filter((s) => s.count > 0)
    .map((s) => ({
      label: STATUS_LABELS[s.status] ?? s.status,
      value: s.count,
      color: STATUS_COLORS[s.status] ?? "#94a3b8",
    }));

  const topCats: Point[] = (data?.topCategories ?? []).map((c) => ({
    label: c.category,
    value: c.count,
  }));

  const activity: ActivityItem[] = (data?.recentActivity ?? []).map((a) => ({
    id: a.id,
    title: humanizeAction(a.action),
    meta: a.actor || a.resource_type || undefined,
    at: a.created_at,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="System overview, key metrics, and recent activity."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-slate-300"
            render={<Link href="/admin/queries" />}
            nativeButton={false}
          >
            View all queries
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        }
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !m ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Total queries"
              value={m.totalQueries}
              icon={MessagesSquare}
              accent="blue"
              hint={`${m.queriesToday} today · ${m.queriesThisWeek} this week`}
            />
            <MetricCard
              label="Open queries"
              value={m.openQueries}
              icon={Inbox}
              accent="amber"
              hint={`${m.inProgressQueries} in progress`}
            />
            <MetricCard
              label="Resolved"
              value={m.resolvedQueries}
              icon={CheckCircle2}
              accent="emerald"
              hint={`${m.closedQueries} closed`}
            />
            <MetricCard
              label="Total users"
              value={m.totalUsers}
              icon={Users}
              accent="violet"
              hint={`${m.activeEmployees} active · ${m.suspendedUsers} suspended`}
            />
          </>
        )}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading || !m ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="Employees" value={m.totalEmployees} accent="slate" />
            <MetricCard label="Administrators" value={m.totalAdmins} accent="slate" />
            <MetricCard label="Conversations" value={m.totalConversations} accent="slate" />
            <MetricCard
              label="Policy documents"
              value={m.totalDocuments}
              icon={Files}
              accent="blue"
              hint={`${m.activeDocuments} active`}
            />
          </>
        )}
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Query volume"
          description="Daily queries over the last 30 days"
          className="lg:col-span-2"
        >
          {loading ? (
            <Skeleton className="h-[160px] w-full" />
          ) : (
            <LineChart data={trend} height={180} />
          )}
        </SectionCard>

        <SectionCard title="Queries by status">
          {loading ? (
            <Skeleton className="mx-auto h-[160px] w-[160px] rounded-full" />
          ) : (
            <div className="flex justify-center py-2">
              <DonutChart data={statusSlices} size={150} />
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Top categories" description="Most-asked query topics">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <RankList data={topCats} emptyLabel="No categorized queries yet" />
          )}
        </SectionCard>

        <SectionCard
          title="Recent queries"
          className="lg:col-span-2"
          action={
            <Link
              href="/admin/queries"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              See all
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
          bodyClassName="p-0"
        >
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.recentQueries ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No queries yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(data?.recentQueries ?? []).map((q) => (
                <li key={q.id}>
                  <Link
                    href="/admin/queries"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Clock className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {q.query || "Untitled query"}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {q.employee.name} · {formatRelativeTime(q.updated_at)}
                      </span>
                    </span>
                    <StatusBadge status={q.status} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Recent activity */}
      <SectionCard
        title="Recent activity"
        description="Latest administrative and system actions"
        action={
          <Link
            href="/admin/audit-logs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Audit logs
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      >
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <ActivityList items={activity} />
        )}
      </SectionCard>
    </div>
  );
}

export default OverviewView;
