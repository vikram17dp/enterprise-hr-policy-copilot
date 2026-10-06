"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  CheckCircle2,
  Download,
  ExternalLink,
  Replace,
  Trash2,
} from "lucide-react";

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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ErrorState } from "@/components/shared/ErrorState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useApi } from "@/hooks/useApi";
import {
  getPolicy,
  updatePolicy,
  replacePolicy,
  deletePolicy,
} from "@/lib/api/admin";
import { formatDate, formatDateTime } from "@/lib/utils/formatDate";
import { toErrorMessage } from "@/types/api";

interface PolicyDetailDialogProps {
  policyId: string;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

type PendingAction = "archive" | "activate" | "delete" | null;

/**
 * Policy detail + management: view metadata, edit title/category/description,
 * activate/archive, download the stored original (Cloudinary), replace the file
 * (re-ingests and bumps the version), and permanently delete (removes vectors,
 * Cloudinary object, and the row). Destructive actions are confirmed.
 */
export function PolicyDetailDialog({
  policyId,
  onOpenChange,
  onChanged,
}: PolicyDetailDialogProps) {
  const { data, loading, error, refetch } = useApi(() => getPolicy(policyId), [policyId]);
  const replaceRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setTitle(data.title ?? "");
      setCategory(data.category ?? "");
      setDescription(data.description ?? "");
    }
  }

  async function saveMeta() {
    setSaving(true);
    try {
      await updatePolicy(policyId, {
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
      });
      toast.success("Policy updated");
      onChanged();
      refetch();
    } catch (err) {
      toast.error("Couldn't update policy", { description: toErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: string) {
    setSaving(true);
    try {
      await updatePolicy(policyId, { status });
      toast.success(status === "archived" ? "Policy archived" : "Policy activated");
      setPending(null);
      onChanged();
      refetch();
    } catch (err) {
      toast.error("Couldn't change status", { description: toErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleReplaceFile(file: File | undefined | null) {
    if (!file) return;
    setReplacing(true);
    try {
      await replacePolicy(policyId, file);
      toast.success("Policy replaced and re-indexed");
      onChanged();
      refetch();
    } catch (err) {
      toast.error("Couldn't replace policy", { description: toErrorMessage(err) });
    } finally {
      setReplacing(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const res = await deletePolicy(policyId);
      toast.success("Policy deleted", {
        description: res.vectorsDeleted
          ? "Vectors removed from the index."
          : "Row removed (no vectors found).",
      });
      setPending(null);
      onOpenChange(false);
      onChanged();
    } catch (err) {
      toast.error("Couldn't delete policy", { description: toErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  function handleConfirm() {
    if (pending === "archive") void changeStatus("archived");
    else if (pending === "activate") void changeStatus("ready");
    else if (pending === "delete") void handleDelete();
  }

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 pr-8 text-base">
              Policy document
              {data ? <StatusBadge status={data.status} /> : null}
            </DialogTitle>
            <DialogDescription className="truncate">
              {data ? `${data.filename} · v${data.version}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {error ? (
              <ErrorState message={error} onRetry={refetch} className="m-5" />
            ) : loading || !data ? (
              <div className="space-y-4 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pd-title" className="text-xs font-semibold text-slate-600">
                      Title
                    </Label>
                    <Input
                      id="pd-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-10 border-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pd-category" className="text-xs font-semibold text-slate-600">
                      Category
                    </Label>
                    <Input
                      id="pd-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. hr_policy"
                      className="h-10 border-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pd-desc" className="text-xs font-semibold text-slate-600">
                    Description
                  </Label>
                  <Textarea
                    id="pd-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="resize-none border-slate-300 text-sm"
                  />
                </div>

                <Button
                  type="button"
                  onClick={saveMeta}
                  disabled={saving}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {saving ? "Saving..." : "Save changes"}
                </Button>

                <Separator />

                {/* Metadata */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Version</dt>
                    <dd className="font-medium text-slate-800">v{data.version}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Uploaded</dt>
                    <dd className="font-medium text-slate-800">{formatDate(data.created_at)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">By</dt>
                    <dd className="truncate font-medium text-slate-800">
                      {data.uploaded_by_name || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Updated</dt>
                    <dd className="font-medium text-slate-800">
                      {data.updated_at ? formatDateTime(data.updated_at) : "—"}
                    </dd>
                  </div>
                </dl>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {data.cloudinary_url ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5 border-slate-300"
                      render={
                        <a href={data.cloudinary_url} target="_blank" rel="noreferrer" />
                      }
                      nativeButton={false}
                    >
                      <Download className="size-4" aria-hidden />
                      Download
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled className="gap-1.5">
                      <Download className="size-4" aria-hidden />
                      Download unavailable
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5 border-slate-300"
                    onClick={() => replaceRef.current?.click()}
                    disabled={replacing}
                  >
                    <Replace className="size-4" aria-hidden />
                    {replacing ? "Replacing..." : "Replace file"}
                  </Button>
                  <input
                    ref={replaceRef}
                    type="file"
                    accept=".pdf,.txt,.md,.docx"
                    className="sr-only"
                    onChange={(e) => handleReplaceFile(e.target.files?.[0])}
                  />

                  {data.status === "archived" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => setPending("activate")}
                    >
                      <CheckCircle2 className="size-4" aria-hidden />
                      Activate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => setPending("archive")}
                    >
                      <Archive className="size-4" aria-hidden />
                      Archive
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => setPending("delete")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </Button>
                </div>

                {data.cloudinary_url ? (
                  <a
                    href={data.cloudinary_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    Stored original (Cloudinary)
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending === "delete"
            ? "Delete this policy?"
            : pending === "archive"
              ? "Archive this policy?"
              : "Activate this policy?"
        }
        description={
          pending === "delete"
            ? "This permanently removes the document, its Cloudinary file, and its vectors from the search index. This can't be undone."
            : pending === "archive"
              ? "Archived policies stay in the system but are marked inactive."
              : "This policy will be marked ready and available again."
        }
        confirmLabel={
          pending === "delete" ? "Delete permanently" : pending === "archive" ? "Archive" : "Activate"
        }
        destructive={pending === "delete"}
        busy={saving}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export default PolicyDetailDialog;
