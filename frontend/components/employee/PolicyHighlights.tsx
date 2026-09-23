"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/utils/formatDate";
import type { PolicyDocument } from "@/types/document";

interface PolicyHighlightsProps {
  documents: PolicyDocument[];
  loading: boolean;
}

/**
 * Recently updated policies. Employees view documents read-only, so clicking
 * navigates to the Policy Documents page.
 */
export function PolicyHighlights({
  documents,
  loading,
}: PolicyHighlightsProps) {
  const visible = documents.slice(0, 4);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Policy Highlights
        </h2>
        <Link
          href="/documents"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          Browse all
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="p-2">
        {loading ? (
          <ul className="space-y-1 p-1">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="rounded-lg px-3 py-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-3 w-32" />
              </li>
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100">
              <FileText className="size-5 text-slate-400" aria-hidden />
            </div>
            <p className="text-sm font-medium text-slate-700">
              No policies published yet
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Updated documents will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {visible.map((doc) => (
              <li key={doc.id}>
                <Link
                  href="/documents"
                  className="group flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {doc.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
                          {doc.category ?? "General"}
                        </span>
                        <span>
                          Updated{" "}
                          {formatRelativeTime(doc.updated_at ?? doc.created_at)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <StatusBadge status={doc.status} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default PolicyHighlights;
