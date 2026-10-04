"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { History, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { chatStore, useChatStore } from "@/store/chatStore";
import {
  deleteConversation,
  getConversations,
  renameConversation,
} from "@/lib/api/chat";
import { cn } from "@/lib/utils/cn";
import { toErrorMessage } from "@/types/api";
import type { ConversationSummary } from "@/types/chat";

type Group = "Today" | "Yesterday" | "Previous";

const GROUP_ORDER: Group[] = ["Today", "Yesterday", "Previous"];

function groupOf(iso: string): Group {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Previous";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  if (d >= startOfToday) return "Today";
  if (d >= startOfYesterday) return "Yesterday";
  return "Previous";
}

/**
 * ChatGPT-style conversation rail shown beside the chat surface.
 *
 * Lists the authenticated user's conversations (newest first, grouped by
 * Today / Yesterday / Previous), and supports New Chat, open, rename, and
 * delete. Opening a conversation navigates to /chat/{id}; the backend enforces
 * ownership, so a conversation the user does not own cannot be loaded.
 */
export function ConversationSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { conversationId: activeId } = useChatStore();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] =
    useState<ConversationSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      // Backend already orders by updated_at DESC; keep that order.
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when the route changes or a new conversation is created, so the rail
  // stays in sync with the chat surface.
  useEffect(() => {
    // Async fetch-on-mount: setState runs only after the awaited request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConversations();
  }, [fetchConversations, pathname, activeId]);

  const grouped = useMemo(() => {
    const buckets: Record<Group, ConversationSummary[]> = {
      Today: [],
      Yesterday: [],
      Previous: [],
    };
    for (const c of conversations) {
      buckets[groupOf(c.updatedAt)].push(c);
    }
    return buckets;
  }, [conversations]);

  const handleNewChat = useCallback(() => {
    chatStore.reset();
    if (pathname !== "/ask") router.push("/ask");
  }, [pathname, router]);

  const openConversation = useCallback(
    (id: string) => {
      if (pathname !== `/chat/${id}`) router.push(`/chat/${id}`);
    },
    [pathname, router]
  );

  const submitRename = useCallback(async () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) {
      toast.error("Title cannot be empty");
      return;
    }
    setSavingRename(true);
    try {
      const updated = await renameConversation(renameTarget.id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
      toast.success("Conversation renamed");
      setRenameTarget(null);
    } catch (err) {
      toast.error("Unable to rename conversation", {
        description: toErrorMessage(err),
      });
    } finally {
      setSavingRename(false);
    }
  }, [renameTarget, renameValue]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteConversation(deleteTarget.id);
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Conversation deleted");
      // If the deleted conversation is open, return to a fresh chat.
      if (activeId === deleteTarget.id) {
        chatStore.reset();
        router.push("/ask");
      }
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Unable to delete conversation", {
        description: toErrorMessage(err),
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeId, router]);

  return (
    <aside className="flex h-[calc(100vh-13rem)] min-h-[480px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 p-3">
        <Button
          type="button"
          onClick={handleNewChat}
          className="h-10 w-full gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="size-4" aria-hidden />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : error ? (
            <div className="p-3 text-center">
              <p className="text-sm text-slate-500">{error}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setLoading(true);
                  void fetchConversations();
                }}
              >
                Retry
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <History className="size-6 text-slate-300" aria-hidden />
              <p className="text-sm text-slate-500">No conversations yet</p>
              <p className="text-xs text-slate-400">
                Ask a question to start one.
              </p>
            </div>
          ) : (
            GROUP_ORDER.map((group) =>
              grouped[group].length === 0 ? null : (
                <div key={group} className="mb-2">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {group}
                  </p>
                  <ul className="space-y-0.5">
                    {grouped[group].map((c) => {
                      const active = pathname === `/chat/${c.id}`;
                      const label = c.title ?? c.lastQuestion ?? "Conversation";
                      return (
                        <li key={c.id}>
                          <div
                            className={cn(
                              "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
                              active
                                ? "bg-blue-50"
                                : "hover:bg-slate-50"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => openConversation(c.id)}
                              className={cn(
                                "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-lg",
                                active
                                  ? "font-semibold text-blue-700"
                                  : "text-slate-600"
                              )}
                            >
                              <MessageSquareText
                                className="size-4 shrink-0 text-slate-400"
                                aria-hidden
                              />
                              <span className="truncate">{label}</span>
                            </button>

                            <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              <button
                                type="button"
                                aria-label="Rename conversation"
                                onClick={() => {
                                  setRenameTarget(c);
                                  setRenameValue(c.title ?? c.lastQuestion ?? "");
                                }}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete conversation"
                                onClick={() => setDeleteTarget(c)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )
            )
          )}
        </div>
      </ScrollArea>

      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Give this conversation a short, useful title.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            maxLength={255}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitRename();
              }
            }}
            placeholder="e.g. 2026 Company Holidays"
            aria-label="Conversation title"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={savingRename}
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingRename}
              onClick={() => void submitRename()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {savingRename ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {deleteTarget?.title ??
                deleteTarget?.lastQuestion ??
                "this conversation"}
              ” and its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => void confirmDelete()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

export default ConversationSidebar;
