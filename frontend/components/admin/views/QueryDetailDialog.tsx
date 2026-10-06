"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bot, Send, User as UserIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/Avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ErrorState } from "@/components/shared/ErrorState";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { useApi } from "@/hooks/useApi";
import {
  getQuery,
  updateQuery,
  respondToQuery,
} from "@/lib/api/admin";
import {
  QUERY_CATEGORIES,
  QUERY_STATUS_OPTIONS,
} from "@/lib/utils/constants";
import { formatDateTime } from "@/lib/utils/formatDate";
import { toErrorMessage } from "@/types/api";
import type { QueryStatus } from "@/types/admin";

interface QueryDetailDialogProps {
  queryId: string;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful status/category/note/response mutation. */
  onUpdated: () => void;
}

/**
 * Full query detail: the complete conversation (from the existing
 * conversations + messages tables), the employee, and admin triage controls —
 * status, category, a private admin note, and a public admin response that is
 * appended to the conversation as an assistant message (source='admin').
 */
export function QueryDetailDialog({
  queryId,
  onOpenChange,
  onUpdated,
}: QueryDetailDialogProps) {
  const { data, loading, error, refetch } = useApi(
    () => getQuery(queryId),
    [queryId]
  );

  const [status, setStatus] = useState<QueryStatus>("open");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [response, setResponse] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [sending, setSending] = useState(false);

  // Sync the form with the fetched query using React's adjust-during-render
  // pattern (avoids a cascading set-state-in-effect). `data` is a fresh object
  // on every load/refetch, so identity change is the reset signal.
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setStatus(data.status);
      setCategory(data.category ?? "");
      setNote(data.adminNote ?? "");
      setResponse("");
    }
  }

  async function handleSaveMeta() {
    setSavingMeta(true);
    try {
      await updateQuery(queryId, {
        status,
        category: category.trim() || undefined,
        admin_note: note,
      });
      toast.success("Query updated");
      onUpdated();
      refetch();
    } catch (err) {
      toast.error("Couldn't update query", { description: toErrorMessage(err) });
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleSendResponse() {
    const message = response.trim();
    if (!message) {
      toast.error("Write a response first");
      return;
    }
    setSending(true);
    try {
      await respondToQuery(queryId, message);
      toast.success("Response sent to conversation");
      setResponse("");
      onUpdated();
      refetch();
    } catch (err) {
      toast.error("Couldn't send response", {
        description: toErrorMessage(err),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base">
            Query detail
            {data ? <StatusBadge status={data.status} /> : null}
          </DialogTitle>
          <DialogDescription className="truncate">
            {data
              ? `${data.employee.full_name || data.employee.email} · opened ${formatDateTime(data.createdAt)}`
              : "Loading conversation..."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <ErrorState message={error} onRetry={refetch} className="m-5" />
          ) : loading || !data ? (
            <div className="space-y-4 p-5">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-2/3" />
              <Skeleton className="h-16 w-3/4" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
              {/* Conversation */}
              <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center gap-3">
                  <UserAvatar
                    name={data.employee.full_name}
                    email={data.employee.email}
                    src={data.employee.avatar_url}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {data.employee.full_name || data.employee.email}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {data.employee.email}
                      {data.employee.department ? ` · ${data.employee.department}` : ""}
                    </p>
                  </div>
                </div>

                <ol className="space-y-3">
                  {data.messages.length === 0 ? (
                    <li className="py-8 text-center text-sm text-slate-400">
                      No messages in this conversation.
                    </li>
                  ) : (
                    data.messages.map((msg) => {
                      const isUser = msg.role === "user";
                      const isAdmin = msg.source === "admin";
                      return (
                        <li
                          key={msg.id}
                          className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          {!isUser ? (
                            <span
                              className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                                isAdmin ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                              }`}
                              aria-hidden
                            >
                              <Bot className="size-4" />
                            </span>
                          ) : null}
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                              isUser
                                ? "bg-blue-600 text-white"
                                : isAdmin
                                  ? "border border-indigo-200 bg-indigo-50 text-slate-800"
                                  : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {isAdmin ? (
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                                Admin response
                              </p>
                            ) : null}
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {msg.content}
                            </p>
                            <p
                              className={`mt-1 text-[10px] ${
                                isUser ? "text-blue-100" : "text-slate-400"
                              }`}
                            >
                              {formatDateTime(msg.createdAt)}
                            </p>
                          </div>
                          {isUser ? (
                            <span
                              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600"
                              aria-hidden
                            >
                              <UserIcon className="size-4" />
                            </span>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ol>
              </div>

              {/* Triage panel */}
              <div className="space-y-5 p-5">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="q-status" className="text-xs font-semibold text-slate-600">
                      Status
                    </Label>
                    <FilterSelect
                      id="q-status"
                      value={status}
                      onChange={(v) => setStatus(v as QueryStatus)}
                      options={QUERY_STATUS_OPTIONS}
                      placeholder="Select status"
                      className="w-full"
                      aria-label="Query status"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="q-category" className="text-xs font-semibold text-slate-600">
                      Category
                    </Label>
                    <Input
                      id="q-category"
                      list="q-category-suggestions"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Leave & Attendance"
                      className="h-10 border-slate-300"
                    />
                    <datalist id="q-category-suggestions">
                      {QUERY_CATEGORIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="q-note" className="text-xs font-semibold text-slate-600">
                      Admin note
                      <span className="ml-1 font-normal text-slate-400">(private)</span>
                    </Label>
                    <Textarea
                      id="q-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Internal notes visible only to admins..."
                      className="resize-none border-slate-300 text-sm"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleSaveMeta}
                    disabled={savingMeta}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {savingMeta ? "Saving..." : "Save changes"}
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="q-response" className="text-xs font-semibold text-slate-600">
                    Respond to employee
                  </Label>
                  <Textarea
                    id="q-response"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={4}
                    placeholder="Write a reply — it's added to the conversation as an admin response..."
                    className="resize-none border-slate-300 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendResponse}
                    disabled={sending || !response.trim()}
                    className="w-full gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    <Send className="size-4" aria-hidden />
                    {sending ? "Sending..." : "Send response"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QueryDetailDialog;
