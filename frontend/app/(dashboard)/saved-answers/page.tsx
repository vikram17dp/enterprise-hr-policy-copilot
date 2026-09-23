"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/Header";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDebounce } from "@/hooks/useDebounce";
import { getSavedAnswers, removeSavedAnswer } from "@/lib/api/chat";
import { ASK_QUERY_PARAM } from "@/lib/utils/constants";
import { formatDate } from "@/lib/utils/formatDate";
import { toErrorMessage } from "@/types/api";
import type { SavedAnswer } from "@/types/chat";

const selectClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

/**
 * Route: /saved-answers
 * Search, filter by category, open, and remove saved answers.
 */
export default function SavedAnswersPage() {
  const router = useRouter();

  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [category, setCategory] = useState("all");

  const [removeTarget, setRemoveTarget] = useState<SavedAnswer | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getSavedAnswers();
      setAnswers(data);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Async fetch-on-mount: setState runs only after the awaited request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    answers.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set).sort();
  }, [answers]);

  const visible = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return answers.filter((a) => {
      const matchesTerm =
        !term ||
        a.question.toLowerCase().includes(term) ||
        a.answer.toLowerCase().includes(term) ||
        (a.source ?? "").toLowerCase().includes(term);
      const matchesCategory = category === "all" || a.category === category;
      return matchesTerm && matchesCategory;
    });
  }, [answers, debouncedSearch, category]);

  const openAnswer = (answer: SavedAnswer) => {
    router.push(
      `/ask?${ASK_QUERY_PARAM}=${encodeURIComponent(answer.question)}`
    );
  };

  const handleRemove = async (answer: SavedAnswer) => {
    setRemoving(true);
    try {
      await removeSavedAnswer(answer.id);
      setAnswers((prev) => prev.filter((a) => a.id !== answer.id));
      toast.success("Answer removed from saved answers.");
      setRemoveTarget(null);
    } catch (err) {
      toast.error("Unable to remove saved answer", {
        description: toErrorMessage(err),
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved Answers"
        description="Quickly access HR policy answers you've saved."
      />

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search saved answers..."
          className="sm:w-80"
          aria-label="Search saved answers"
        />
        <div className="sm:ml-auto">
          <label className="sr-only" htmlFor="category-filter">
            Filter by category
          </label>
          <select
            id="category-filter"
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
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Unable to load your saved answers"
          message={error}
          onRetry={reload}
        />
      ) : answers.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved answers yet"
          description="Save answers from the Ask page to build your personal HR reference library."
          actionLabel="Ask a question"
          onAction={() => router.push("/ask")}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No matching answers"
          description="Try a different search term or category."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch("");
            setCategory("all");
          }}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visible.map((answer) => (
            <li
              key={answer.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold leading-6 text-slate-900">
                  {answer.question}
                </h3>
                {answer.category ? (
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {answer.category}
                  </span>
                ) : null}
              </div>

              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                {answer.answer}
              </p>

              {answer.source ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <FileText className="size-3.5" aria-hidden />
                  <span className="truncate">{answer.source}</span>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">
                  Saved {formatDate(answer.savedAt)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openAnswer(answer)}
                    className="rounded-lg border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove from saved answers"
                    onClick={() => setRemoveTarget(answer)}
                    className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Remove confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove saved answer?</AlertDialogTitle>
            <AlertDialogDescription>
              “{removeTarget?.question}” will be removed from your saved
              answers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={() => {
                if (removeTarget) void handleRemove(removeTarget);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {removing ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
