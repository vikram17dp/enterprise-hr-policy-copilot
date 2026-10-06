"use client";

import { useState } from "react";
import { Files, Upload, ChevronRight } from "lucide-react";

import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { listPolicies } from "@/lib/api/admin";
import { PageHeader } from "@/components/shared/Header";
import { SearchBar } from "@/components/shared/SearchBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Button } from "@/components/ui/button";
import { PolicyUploadDialog } from "@/components/admin/views/PolicyUploadDialog";
import { PolicyDetailDialog } from "@/components/admin/views/PolicyDetailDialog";
import { ADMIN_PAGE_SIZE, POLICY_STATUS_OPTIONS } from "@/lib/utils/constants";
import { formatDate } from "@/lib/utils/formatDate";
import type { AdminPolicy } from "@/types/admin";

const CATEGORY_OPTIONS = [
  { value: "hr_policy", label: "hr_policy" },
  { value: "benefits", label: "benefits" },
  { value: "leave", label: "leave" },
  { value: "payroll", label: "payroll" },
  { value: "conduct", label: "conduct" },
];

export function PoliciesView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  const { data, loading, error, refetch } = useApi(
    () =>
      listPolicies({
        search: debouncedSearch,
        category,
        status,
        page,
        page_size: ADMIN_PAGE_SIZE,
      }),
    [debouncedSearch, category, status, page]
  );

  const columns: Column<AdminPolicy>[] = [
    {
      key: "title",
      header: "Title",
      className: "max-w-[240px]",
      cell: (row) => (
        <span className="block truncate font-medium text-slate-800">
          {row.title}
        </span>
      ),
    },
    {
      key: "filename",
      header: "File",
      className: "max-w-[180px]",
      cell: (row) => (
        <span className="block truncate text-xs text-slate-500">{row.filename}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (row) =>
        row.category ? (
          <span className="inline-block max-w-[120px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {row.category}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "version",
      header: "Ver.",
      align: "center",
      cell: (row) => (
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          v{row.version}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "uploaded_by",
      header: "Uploaded by",
      className: "max-w-[160px]",
      cell: (row) => (
        <span className="block truncate text-xs text-slate-600">
          {row.uploaded_by_name || "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Added",
      cell: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: () => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
          Manage
          <ChevronRight className="size-4" aria-hidden />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Policy Documents"
        description="Upload, update, and manage the HR knowledge base."
        actions={
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="size-4" aria-hidden />
            Upload policy
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by title or filename..."
          aria-label="Search policies"
          className="sm:w-80"
        />
        <FilterSelect
          value={category}
          onChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
          options={CATEGORY_OPTIONS}
          placeholder="All categories"
          aria-label="Filter by category"
          className="sm:w-48"
        />
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={POLICY_STATUS_OPTIONS}
          placeholder="All statuses"
          aria-label="Filter by status"
          className="sm:w-44"
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
        page={page}
        pageSize={ADMIN_PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyIcon={Files}
        emptyTitle="No policy documents"
        emptyDescription="Upload a PDF, TXT, MD, or DOCX to build the knowledge base."
        emptyActionLabel="Upload policy"
        onEmptyAction={() => setUploadOpen(true)}
        skeletonRows={ADMIN_PAGE_SIZE}
      />

      <PolicyUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={refetch}
      />

      {selectedId ? (
        <PolicyDetailDialog
          policyId={selectedId}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          onChanged={refetch}
        />
      ) : null}
    </div>
  );
}

export default PoliciesView;
