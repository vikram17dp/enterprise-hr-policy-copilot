"use client";

import { useCallback, useState } from "react";
import { MessagesSquare, ChevronRight } from "lucide-react";

import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { listQueries } from "@/lib/api/admin";
import { PageHeader } from "@/components/shared/Header";
import { SearchBar } from "@/components/shared/SearchBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { QueryDetailDialog } from "@/components/admin/views/QueryDetailDialog";
import {
  ADMIN_PAGE_SIZE,
  QUERY_CATEGORIES,
  QUERY_STATUS_OPTIONS,
} from "@/lib/utils/constants";
import { formatDate, formatRelativeTime } from "@/lib/utils/formatDate";
import type { AdminQueryRow, QueryStatus } from "@/types/admin";

export function QueriesView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QueryStatus | "">("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  const { data, loading, error, refetch } = useApi(
    () =>
      listQueries({
        search: debouncedSearch,
        status,
        category,
        page,
        page_size: ADMIN_PAGE_SIZE,
        sort,
        order,
      }),
    [debouncedSearch, status, category, page, sort, order]
  );

  const onSortChange = useCallback(
    (key: string) => {
      if (key === sort) {
        setOrder((o) => (o === "asc" ? "desc" : "asc"));
      } else {
        setSort(key);
        setOrder("desc");
      }
      setPage(1);
    },
    [sort]
  );

  const columns: Column<AdminQueryRow>[] = [
    {
      key: "query",
      header: "Query",
      sortable: true,
      sortKey: "query",
      className: "max-w-[280px]",
      cell: (row) => (
        <span className="block truncate font-medium text-slate-800">
          {row.query || "Untitled query"}
        </span>
      ),
    },
    {
      key: "employee",
      header: "Employee",
      sortable: true,
      sortKey: "employee",
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-slate-800">
            {row.employee.name}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {row.employee.email}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortKey: "status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "category",
      header: "Category",
      cell: (row) =>
        row.category ? (
          <span className="inline-block max-w-[140px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {row.category}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "messages",
      header: "Msgs",
      align: "center",
      cell: (row) => (
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          {row.messageCount}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      sortKey: "created_at",
      cell: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "updated_at",
      header: "Updated",
      sortable: true,
      sortKey: "updated_at",
      cell: (row) => (
        <span className="text-xs text-slate-500">
          {formatRelativeTime(row.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: () => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
          View
          <ChevronRight className="size-4" aria-hidden />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employee Queries"
        description="Review, triage, and respond to employee HR queries."
      />

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by query or employee..."
          aria-label="Search queries"
          className="sm:w-80"
        />
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v as QueryStatus | "");
            setPage(1);
          }}
          options={QUERY_STATUS_OPTIONS}
          placeholder="All statuses"
          aria-label="Filter by status"
          className="sm:w-44"
        />
        <FilterSelect
          value={category}
          onChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
          options={QUERY_CATEGORIES.map((c) => ({ value: c, label: c }))}
          placeholder="All categories"
          aria-label="Filter by category"
          className="sm:w-52"
        />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={refetch}
        onRowClick={(row) => setSelectedId(row.id)}
        sort={sort}
        order={order}
        onSortChange={onSortChange}
        page={page}
        pageSize={ADMIN_PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyIcon={MessagesSquare}
        emptyTitle="No queries found"
        emptyDescription="Try adjusting your search or filters."
        skeletonRows={ADMIN_PAGE_SIZE}
      />

      {selectedId ? (
        <QueryDetailDialog
          queryId={selectedId}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          onUpdated={refetch}
        />
      ) : null}
    </div>
  );
}

export default QueriesView;
