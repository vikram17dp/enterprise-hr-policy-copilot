"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquareText, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { submitFeedback } from "@/lib/api/feedback";
import { ASK_EXAMPLES } from "@/lib/utils/constants";
import { toErrorMessage } from "@/types/api";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatWindowProps {
  /** Prefills the composer (e.g. from the dashboard ?q= param). */
  initialQuery?: string;
}

/**
 * The AI chat surface: empty state with examples, message list, and composer.
 * Owns chat state via the useChat hook and handles copy/save/feedback.
 */
export function ChatWindow({ initialQuery }: ChatWindowProps) {
  const { messages, isPending, send, save, reset } = useChat();

  const [input, setInput] = useState(initialQuery ?? "");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isPending]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isPending) return;
    setInput("");
    void send(text);
  }, [input, isPending, send]);

  const handleCopy = useCallback(async (message: ChatMessageType) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      toast.success("Answer copied to clipboard");
      setTimeout(
        () => setCopiedId((id) => (id === message.id ? null : id)),
        1500
      );
    } catch {
      toast.error("Unable to copy answer");
    }
  }, []);

  const handleSave = useCallback(
    async (message: ChatMessageType) => {
      if (message.saved) {
        toast.info("This answer is already saved");
        return;
      }

      const index = messages.findIndex((m) => m.id === message.id);
      let question = "";
      for (let i = index - 1; i >= 0; i -= 1) {
        if (messages[i].role === "user") {
          question = messages[i].content;
          break;
        }
      }

      try {
        await save(message, question || "Saved answer");
        toast.success("Answer saved successfully");
      } catch (err) {
        toast.error("Unable to save your answer", {
          description: toErrorMessage(err),
        });
      }
    },
    [messages, save]
  );

  const handleFeedback = useCallback(
    async (_message: ChatMessageType, rating: number) => {
      try {
        await submitFeedback({
          rating,
          comment: "",
          category: "answer_accuracy",
        });
        toast.success(
          rating >= 4
            ? "Thanks for your feedback!"
            : "Thanks — we'll use this to improve answers."
        );
      } catch (err) {
        toast.error("Unable to submit feedback", {
          description: toErrorMessage(err),
        });
      }
    },
    []
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Chat top bar */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-blue-600/10 text-blue-600">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-slate-800">
            HR Copilot Assistant
          </span>
        </div>

        {hasMessages ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setInput("");
            }}
            className="gap-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            New chat
          </Button>
        ) : null}
      </div>

      {/* Messages / empty state */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className="space-y-6 p-4 sm:p-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                copied={copiedId === message.id}
                onCopy={handleCopy}
                onSave={handleSave}
                onFeedback={handleFeedback}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600">
              <MessageSquareText className="size-6" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-slate-900">
              How can I help you?
            </h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              Ask anything about your HR policies. Try one of these to get
              started:
            </p>

            <div className="mt-5 flex w-full max-w-md flex-col gap-2">
              {ASK_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={isPending}
                  onClick={() => void send(example)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        disabled={isPending}
      />
    </div>
  );
}

export default ChatWindow;
