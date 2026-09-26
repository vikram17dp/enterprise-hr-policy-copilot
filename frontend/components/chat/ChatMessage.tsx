"use client";

import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Copy,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/Avatar";
import { SourceCitation } from "@/components/chat/SourceCitation";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils/cn";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

interface ChatMessageProps {
  message: ChatMessageType;
  onCopy: (message: ChatMessageType) => void;
  onSave: (message: ChatMessageType) => void;
  onFeedback: (message: ChatMessageType, rating: number) => void;
  copied?: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
        active && "text-emerald-600 hover:text-emerald-700"
      )}
    >
      {children}
    </Button>
  );
}

/**
 * A single chat message. User messages are right-aligned; assistant messages
 * are left-aligned with grounded citations and copy/save/feedback actions.
 */
export function ChatMessage({
  message,
  onCopy,
  onSave,
  onFeedback,
  copied,
}: ChatMessageProps) {
  const { fullName, email } = useUser();

  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-3">
        <div className="flex max-w-[85%] flex-col items-end sm:max-w-[75%]">
          <div className="rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <span className="mt-1 px-1 text-[11px] text-slate-400">
            {formatTime(message.createdAt)}
          </span>
        </div>
        <UserAvatar name={fullName} email={email} size="sm" className="mt-0.5 shrink-0" />
      </div>
    );
  }

  const isError = message.status === "error";
  const isPending = message.status === "pending";

  return (
    <div className="flex justify-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#0b1220] text-white">
        <Sparkles className="size-4 text-blue-400" aria-hidden />
      </span>

      <div className="flex max-w-[85%] min-w-0 flex-col sm:max-w-[80%]">
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm border bg-white px-4 py-3 text-sm leading-6 shadow-sm",
            isError ? "border-red-200 bg-red-50/60" : "border-slate-200"
          )}
        >
          {isPending ? (
            <TypingIndicator />
          ) : isError ? (
            <div className="flex items-start gap-2 text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-[13px] leading-6">
                {message.error ??
                  "Unable to generate an answer. Please try again."}
              </p>
            </div>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        {/* Execution / decision trace from the RAG workflow */}
        {!isPending &&
        !isError &&
        message.executionTrace &&
        message.executionTrace.length > 0 ? (
          <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-[12px] leading-5 text-slate-600">
            <summary className="cursor-pointer select-none font-medium text-slate-500">
              How this answer was produced
            </summary>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
              {message.executionTrace.map((step, i) => (
                <li key={`${step}-${i}`}>{step}</li>
              ))}
            </ol>
          </details>
        ) : null}

        {/* Citations */}
        {!isPending && !isError && message.citations && message.citations.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.citations.map((citation, i) => (
              <SourceCitation key={`${citation.title}-${i}`} citation={citation} index={i} />
            ))}
          </div>
        ) : null}

        {/* Actions */}
        {!isPending && !isError ? (
          <div className="mt-1.5 flex items-center gap-0.5">
            <ActionButton
              label={copied ? "Copied" : "Copy answer"}
              active={copied}
              onClick={() => onCopy(message)}
            >
              {copied ? <Copy className="size-4" /> : <Copy className="size-4" />}
            </ActionButton>

            <ActionButton
              label={message.saved ? "Saved" : "Save answer"}
              active={message.saved}
              onClick={() => onSave(message)}
            >
              {message.saved ? (
                <BookmarkCheck className="size-4" />
              ) : (
                <Bookmark className="size-4" />
              )}
            </ActionButton>

            <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />

            <ActionButton
              label="Good answer"
              onClick={() => onFeedback(message, 5)}
            >
              <ThumbsUp className="size-4" />
            </ActionButton>
            <ActionButton
              label="Needs improvement"
              onClick={() => onFeedback(message, 2)}
            >
              <ThumbsDown className="size-4" />
            </ActionButton>

            <span className="ml-auto px-1 text-[11px] text-slate-400">
              {formatTime(message.createdAt)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ChatMessage;
