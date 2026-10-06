"use client";

import { useState } from "react";
import {
  BarChart3,
  Users,
  UserPlus,
  Files,
  Database,
} from "lucide-react";

import { useApi } from "@/hooks/useApi";
import { getReports } from "@/lib/api/admin";
import { PageHeader } from "@/components/shared/Header";
import { ErrorState } from "@/components/shared/ErrorState";
import { MetricCard, MetricCardSkeleton } from "@/components/admin/MetricCard";
import { SectionCard } from "@/components/admin/SectionCard";
import { FilterSelect } from "@/components/admin/FilterSelect";
import {
  LineChart,
  BarChart,
  DonutChart,
  RankList,
  type Point,
  type Slice,
} from "@/components/admin/charts";
import { Skeleton } from "@/components/ui/skeleton";
import type { QueryStatus } from "@/types/admin";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

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

const PALETTE = ["#2563eb", "#7c3aed", "#0891b2", "#65a30d", "#ea580c", "#db2777", "#64748b"];

export function ReportsView() {
  const [days, setDays] = useState("30");
  const { data, loading, error, refetch } = useApi(
    () => getReports(Number(days)),
    [days]
  );

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Reports & Analytics" />
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  const trend: Point[] = (data?.queriesOverTime ?? []).map((d) => ({
    label: d.date.slice(5),
    value: d.count,
  }));
  const statusSlices: Slice[] = (data?.queriesByStatus ?? [])
    .filter((s) => s.count > 0)
    .map((s) => ({
      label: STATUS_LABELS[s.status] ?? s.status,
      value: s.count,
      color: STATUS_COLORS[s.status] ?? "#94a3b8",
    }));
  const byCategory: Point[] = (data?.queriesByCategory ?? []).map((c) => ({
    label: c.category,
    value: c.count,
  }));
  const byDepartment: Point[] = (data?.queriesByDepartment ?? []).map((d) => ({
    label: d.department,
    value: d.count,
  }));
  const activeUsers: Point[] = (data?.mostActiveUsers ?? []).map((u) => ({
    label: u.email,
    value: u.queries,
  }));
  const docByStatus: Slice[] = (data?.documents.byStatus ?? []).map((s, i) => ({
    label: s.status,
    value: s.count,
    color: PALETTE[i % PALETTE.length],
  }));
  const feedback: Point[] = (data?.feedbackByRating ?? []).map((f) => ({
    label: f.rating,
    value: f.count,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & Analytics"
        description="Trends and insights across queries, users, and policies."
        actions={
          <FilterSelect
            value={days}
            onChange={setDays}
            options={RANGE_OPTIONS}
            aria-label="Date range"
            className="w-44"
          />
        }
      />

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading || !data ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Active users"
              value={data.activeUsers}
              icon={Users}
              accent="blue"
              hint={`in range (${data.rangeDays}d)`}
            />
            <MetricCard
              label="New users"
              value={data.newUsers}
              icon={UserPlus}
              accent="emerald"
              hint={`joined in range`}
            />
            <MetricCard
              label="Documents"
              value={data.documents.total}
              icon={Files}
              accent="violet"
            />
            <MetricCard
              label="Cache"
              value={data.cache.redisStatus === "ok" ? "Online" : "Offline"}
              icon={Database}
              accent={data.cache.redisStatus === "ok" ? "emerald" : "rose"}
              hint={`TTL ${data.cache.cacheTtl}s`}
            />
          </>
        )}
      </div>

      {/* Query trend */}
      <SectionCard
        title="Query volume over time"
        description={`Daily query counts across the selected range`}
      >
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <LineChart data={trend} height={220} />
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Queries by status">
          {loading ? (
            <Skeleton className="mx-auto h-[160px] w-[160px] rounded-full" />
          ) : (
            <div className="flex justify-center py-2">
              <DonutChart data={statusSlices} size={160} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Queries by category">
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <BarChart data={byCategory} height={200} color="#7c3aed" />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Queries by department">
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <RankList
              data={byDepartment}
              color="#0891b2"
              emptyLabel="No department data yet"
            />
          )}
        </SectionCard>

        <SectionCard title="Most active users" description="By query count in range">
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <RankList data={activeUsers} emptyLabel="No activity in range" />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Documents by status">
          {loading ? (
            <Skeleton className="mx-auto h-[160px] w-[160px] rounded-full" />
          ) : (
            <div className="flex justify-center py-2">
              <DonutChart data={docByStatus} size={160} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Feedback by rating" description="Employee answer ratings">
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <BarChart data={feedback} height={200} color="#65a30d" />
          )}
        </SectionCard>
      </div>

      {loading ? null : (
        <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-slate-400">
          <BarChart3 className="size-3.5" aria-hidden />
          Range: last {data?.rangeDays ?? days} days
        </p>
      )}
    </div>
  );
}

export default ReportsView;
