"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { History, MessageSquareText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/Header";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import {
  deleteConversation,
  getConversations,
} from "@/lib/api/chat";
import { ASK_QUERY_PARAM } from "@/lib/utils/constants";
import { formatRelativeTime } from "@/lib/utils/formatDate";
import { toErrorMessage } from "@/types/api";
import type { ConversationSummary } from "@/types/chat";

type SortKey = "recent" | "oldest" | "messages";

const selectClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

/**
 * Route: /conversations
 * View, search, filter, sort, continue, and delete past conversations.
 */
export default function ConversationsPage() {
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const [deleteTarget, setDeleteTarget] =
    useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
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

  const visible = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    let list = conversations.filter((c) => {
      const matchesTerm =
        !term ||
        (c.title ?? "").toLowerCase().includes(term) ||
        (c.lastQuestion ?? "").toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "all" || c.status === statusFilter;
      return matchesTerm && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === "messages") return b.messageCount - a.messageCount;
      const aTime = +new Date(sortKey === "oldest" ? a.createdAt : a.updatedAt);
      const bTime = +new Date(sortKey === "oldest" ? b.createdAt : b.updatedAt);
      return sortKey === "oldest" ? aTime - bTime : bTime - aTime;
    });

    return list;
  }, [conversations, debouncedSearch, statusFilter, sortKey]);

  const openConversation = (conversation: ConversationSummary) => {
    const q = conversation.lastQuestion ?? conversation.title ?? "";
    router.push(
      q ? `/ask?${ASK_QUERY_PARAM}=${encodeURIComponent(q)}` : "/ask"
    );
  };

  const handleDelete = async (conversation: ConversationSummary) => {
    setDeleting(true);
    try {
      await deleteConversation(conversation.id);
      setConversations((prev) =>
        prev.filter((c) => c.id !== conversation.id)
      );
      toast.success("Conversation deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Unable to delete conversation", {
        description: toErrorMessage(err),
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Conversations"
        description="View and continue your previous HR policy conversations."
        actions={
          <Button
            type="button"
            onClick={() => router.push("/ask")}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New question
          </Button>
        }
      />

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search conversations..."
          className="sm:w-80"
          aria-label="Search conversations"
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <label className="sr-only" htmlFor="status-filter">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

          <label className="sr-only" htmlFor="sort-key">
            Sort conversations
          </label>
          <select
            id="sort-key"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={selectClass}
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest</option>
            <option value="messages">Most messages</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-3 h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Unable to load your conversations"
          message={error}
          onRetry={reload}
        />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={History}
          title="No conversations yet"
          description="When you ask the HR Copilot a question, your conversation will be saved here."
          actionLabel="Ask your first question"
          onAction={() => router.push("/ask")}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No matching conversations"
          description="Try adjusting your search or filters."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch("");
            setStatusFilter("all");
            setSortKey("recent");
          }}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((conversation) => (
            <li
              key={conversation.id}
              className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <MessageSquareText className="size-5" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {conversation.title ?? "Conversation"}
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {conversation.lastQuestion ?? "No questions yet"}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {formatRelativeTime(conversation.updatedAt)} ·{" "}
                  {conversation.messageCount} messages
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={conversation.status} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openConversation(conversation)}
                  className="rounded-lg border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Open
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete conversation"
                  onClick={() => setDeleteTarget(conversation)}
                  className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove “
              {deleteTarget?.title ?? deleteTarget?.lastQuestion ??
                "this conversation"}
              ” and its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
