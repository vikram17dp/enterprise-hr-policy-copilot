"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

/**
 * Compact pager: shows the visible range and prev/next controls. Server-side
 * pagination — the parent refetches when `page` changes.
 */
export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row">
      <p className="text-xs text-slate-500 tabular-nums">
        Showing <span className="font-medium text-slate-700">{from}</span>–
        <span className="font-medium text-slate-700">{to}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="h-8 gap-1 border-slate-300"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <span className="px-2 text-xs font-medium text-slate-600 tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className="h-8 gap-1 border-slate-300"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
