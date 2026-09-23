"use client";

import { useMemo, useState } from "react";
import { CalendarDays, FileText, Layers, Tag } from "lucide-react";

import { PageHeader } from "@/components/shared/Header";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDocuments } from "@/hooks/useDocuments";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate } from "@/lib/utils/formatDate";
import type { PolicyDocument } from "@/types/document";

const selectClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

type SortKey = "updated" | "title" | "version";

/**
 * Route: /documents
 * Employees can VIEW policy documents only. Upload/delete/management is an
 * Admin capability and is intentionally not exposed here.
 */
export default function DocumentsPage() {
  const { documents, loading, error, reload } = useDocuments();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [category, setCategory] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [preview, setPreview] = useState<PolicyDocument | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set).sort();
  }, [documents]);

  const visible = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    const list = documents.filter((d) => {
      const matchesTerm =
        !term ||
        d.title.toLowerCase().includes(term) ||
        d.filename.toLowerCase().includes(term) ||
        (d.description ?? "").toLowerCase().includes(term);
      const matchesCategory = category === "all" || d.category === category;
      return matchesTerm && matchesCategory;
    });

    return [...list].sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      if (sortKey === "version") return b.version - a.version;
      return (
        +new Date(b.updated_at ?? b.created_at) -
        +new Date(a.updated_at ?? a.created_at)
      );
    });
  }, [documents, debouncedSearch, category, sortKey]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy Documents"
        description="Browse your organization's HR policies and guidelines."
      />

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search policies..."
          className="sm:w-80"
          aria-label="Search policy documents"
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <label className="sr-only" htmlFor="doc-category">
            Filter by category
          </label>
          <select
            id="doc-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={selectClass}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="doc-sort">
            Sort documents
          </label>
          <select
            id="doc-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={selectClass}
          >
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
            <option value="version">Highest version</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-2 h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Unable to load documents"
          message={error}
          onRetry={() => void reload()}
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents available"
          description="Policy documents published by your HR team will appear here."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No matching documents"
          description="Try a different search term or category."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch("");
            setCategory("all");
          }}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <FileText className="size-5" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {doc.title}
                  </p>
                  {doc.category ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {doc.category}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>v{doc.version}</span>
                  <span>Updated {formatDate(doc.updated_at ?? doc.created_at)}</span>
                  <span className="truncate">{doc.filename}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={doc.status} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreview(doc)}
                  className="rounded-lg border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  View
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Preview dialog */}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <FileText className="size-5 text-blue-600" aria-hidden />
              {preview?.title}
            </DialogTitle>
            <DialogDescription>
              {preview?.description ?? "No description available."}
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="space-y-3 py-1">
              <MetaRow icon={Tag} label="Category" value={preview.category ?? "General"} />
              <MetaRow icon={Layers} label="Version" value={`v${preview.version}`} />
              <MetaRow
                icon={CalendarDays}
                label="Last updated"
                value={formatDate(preview.updated_at ?? preview.created_at)}
              />
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs font-medium text-slate-500">Status</span>
                <StatusBadge status={preview.status} />
              </div>

              {preview.cloudinary_url ? (
                <Button
                  type="button"
                  onClick={() =>
                    window.open(preview.cloudinary_url ?? "", "_blank", "noopener")
                  }
                  className="mt-2 h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Open document
                </Button>
              ) : (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                  A full document preview will be available once the file is
                  published to storage by your HR administrator.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="size-4 text-slate-400" aria-hidden />
        {label}
      </span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  );
}
