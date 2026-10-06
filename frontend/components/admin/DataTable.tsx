"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Pagination } from "@/components/admin/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

export interface Column<T> {
  /** Stable key used for React list keys and to identify the sort field. */
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Enables a clickable sort control on this column's header. */
  sortable?: boolean;
  /** Backend sort field name when different from `key`. */
  sortKey?: string;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRowClick?: (row: T) => void;
  /** Current server-side sort field. */
  sort?: string;
  order?: "asc" | "desc";
  onSortChange?: (sortKey: string) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  skeletonRows?: number;
  className?: string;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Generic, server-driven data table used by every admin list page (queries,
 * users, policies, audit logs). It owns the shared concerns — loading
 * skeletons, empty state, error state with retry, optional column sorting, and
 * pagination — so each view only declares its columns and rows.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyIcon,
  emptyActionLabel,
  onEmptyAction,
  onRowClick,
  sort,
  order = "desc",
  onSortChange,
  page,
  pageSize,
  total,
  onPageChange,
  skeletonRows = 6,
  className,
}: DataTableProps<T>) {
  const showPagination =
    page != null && pageSize != null && total != null && onPageChange != null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      {error ? (
        <ErrorState
          title="Couldn't load data"
          message={error}
          onRetry={onRetry}
          className="rounded-none border-0"
        />
      ) : (
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-slate-50">
              {columns.map((col) => {
                const sortField = col.sortKey ?? col.key;
                const isSorted = col.sortable && sort === sortField;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "h-11 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500",
                      alignClass[col.align ?? "left"],
                      col.headerClassName
                    )}
                    aria-sort={
                      isSorted
                        ? order === "asc"
                          ? "ascending"
                          : "descending"
                        : col.sortable
                          ? "none"
                          : undefined
                    }
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(sortField)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                          isSorted && "text-slate-900",
                          col.align === "right" && "flex-row-reverse"
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          order === "asc" ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="size-3.5 text-slate-400"
                            aria-hidden
                          />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, r) => (
                <TableRow key={`skeleton-${r}`}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className="px-3 py-3">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="px-0 py-0 whitespace-normal"
                >
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    actionLabel={emptyActionLabel}
                    onAction={onEmptyAction}
                    className="rounded-none border-0"
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "px-3 py-3 text-sm text-slate-700",
                        alignClass[col.align ?? "left"],
                        col.className
                      )}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {showPagination && !error ? (
        <Pagination
          page={page!}
          pageSize={pageSize!}
          total={total!}
          onPage={onPageChange!}
        />
      ) : null}
    </div>
  );
}

export default DataTable;
