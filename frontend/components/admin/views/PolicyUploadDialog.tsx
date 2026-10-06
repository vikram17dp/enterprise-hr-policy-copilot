"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, UploadCloud, X } from "lucide-react";

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
import { uploadPolicy } from "@/lib/api/admin";
import { toErrorMessage } from "@/types/api";
import { cn } from "@/lib/utils/cn";

const ACCEPT = ".pdf,.txt,.md,.docx";
const MAX_BYTES = 25 * 1024 * 1024;

interface PolicyUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

/**
 * Upload a policy document. Reuses the existing ingestion pipeline on the
 * backend (chunk → Cohere embed → Pinecone upsert, plus best-effort Cloudinary
 * storage). Shows file validation, upload progress, and any non-fatal warnings
 * (e.g. Cloudinary unavailable) returned by the API.
 */
export function PolicyUploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: PolicyUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setCategory("");
    setDescription("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function acceptFile(f: File | undefined | null) {
    if (!f) return;
    const ext = `.${f.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (![".pdf", ".txt", ".md", ".docx"].includes(ext)) {
      setError(`Unsupported file type "${ext || "unknown"}". Use PDF, TXT, MD, or DOCX.`);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("File exceeds the 25 MB limit.");
      return;
    }
    setError(null);
    setFile(f);
    if (!title.trim()) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleUpload() {
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("A document title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await uploadPolicy({
        file,
        title: title.trim(),
        category: category.trim() || undefined,
        description: description.trim() || undefined,
      });
      toast.success("Policy uploaded and indexed", {
        description: res.document.title,
      });
      if (res.warnings?.length) {
        toast.warning("Uploaded with a note", {
          description: res.warnings.join(" "),
          duration: 8000,
        });
      }
      reset();
      onOpenChange(false);
      onUploaded();
    } catch (err) {
      const msg = toErrorMessage(err);
      setError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload policy document</DialogTitle>
          <DialogDescription>
            The file is chunked, embedded, and indexed into the knowledge base.
            Supported: PDF, TXT, MD, DOCX (max 25 MB).
          </DialogDescription>
        </DialogHeader>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 bg-slate-50 hover:border-slate-400"
          )}
        >
          {file ? (
            <div className="flex w-full items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <FileUp className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {file.name}
                </span>
                <span className="block text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                aria-label="Remove file"
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <UploadCloud className="mb-2 size-8 text-slate-400" aria-hidden />
              <p className="text-sm font-medium text-slate-700">
                Drag &amp; drop, or{" "}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-blue-600 underline-offset-2 hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-xs text-slate-400">PDF, TXT, MD, or DOCX</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-title" className="text-xs font-semibold text-slate-600">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="p-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Employee Handbook 2026"
              className="h-10 border-slate-300"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-category" className="text-xs font-semibold text-slate-600">
              Category
            </Label>
            <Input
              id="p-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. hr_policy, benefits"
              className="h-10 border-slate-300"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc" className="text-xs font-semibold text-slate-600">
              Description
            </Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional summary..."
              className="resize-none border-slate-300 text-sm"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={busy || !file}
            className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
          >
            <UploadCloud className="size-4" aria-hidden />
            {busy ? "Uploading..." : "Upload & index"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PolicyUploadDialog;
