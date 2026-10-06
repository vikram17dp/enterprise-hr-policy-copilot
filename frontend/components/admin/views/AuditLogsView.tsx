"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";

import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { listAuditLogs } from "@/lib/api/admin";
import { PageHeader } from "@/components/shared/Header";
import { SearchBar } from "@/components/shared/SearchBar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { ADMIN_PAGE_SIZE } from "@/lib/utils/constants";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/formatDate";
import type { AuditLogRow } from "@/types/admin";

/** Resource-level action filters (backend matches action by substring). */
const ACTION_FILTERS = [
  { value: "query", label: "Queries" },
  { value: "user", label: "Users" },
  { value: "policy", label: "Policies" },
  { value: "settings", label: "Settings" },
  { value: "cache", label: "Maintenance" },
];

const ACTION_TONES: Record<string, string> = {
  deleted: "border-red-200 bg-red-50 text-red-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  suspended: "border-amber-200 bg-amber-50 text-amber-700",
  uploaded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  created: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function humanizeAction(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toneFor(action: string): string {
  for (const [key, cls] of Object.entries(ACTION_TONES)) {
    if (action.includes(key)) return cls;
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function AuditLogsView() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 350);

  const { data, loading, error, refetch } = useApi(
    () =>
      listAuditLogs({
        search: debouncedSearch,
        action,
        page,
        page_size: ADMIN_PAGE_SIZE,
      }),
    [debouncedSearch, action, page]
  );

  const columns: Column<AuditLogRow>[] = [
    {
      key: "action",
      header: "Action",
      className: "max-w-[200px]",
      cell: (row) => (
        <span
          className={`inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-xs font-medium ${toneFor(row.action)}`}
          title={row.action}
        >
          {humanizeAction(row.action)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      className: "max-w-[180px]",
      cell: (row) => (
        <span className="block truncate text-sm text-slate-700">
          {row.actor?.email ?? "System"}
        </span>
      ),
    },
    {
      key: "resource",
      header: "Resource",
      cell: (row) =>
        row.resourceType ? (
          <span className="text-xs text-slate-600">
            {row.resourceType}
            {row.resourceId ? (
              <span className="ml-1 font-mono text-[10px] text-slate-400">
                #{row.resourceId.slice(0, 8)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "details",
      header: "Details",
      className: "max-w-[320px]",
      cell: (row) => (
        <span className="block truncate text-xs text-slate-500" title={row.details ?? ""}>
          {row.details || "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "When",
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500" title={formatDateTime(row.createdAt)}>
          {formatRelativeTime(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="A record of administrative and system actions."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search action, details, actor, or resource..."
          aria-label="Search audit logs"
          className="sm:w-96"
        />
        <FilterSelect
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          options={ACTION_FILTERS}
          placeholder="All areas"
          aria-label="Filter by area"
          className="sm:w-48"
        />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={refetch}
        page={page}
        pageSize={ADMIN_PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyIcon={ScrollText}
        emptyTitle="No audit events"
        emptyDescription="Administrative actions will appear here as they happen."
        skeletonRows={ADMIN_PAGE_SIZE}
      />
    </div>
  );
}

export default AuditLogsView;
