"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquareText, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { submitFeedback } from "@/lib/api/feedback";
import { chatStore } from "@/store/chatStore";
import { ASK_EXAMPLES } from "@/lib/utils/constants";
import { toErrorMessage } from "@/types/api";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatWindowProps {
  /** Prefills the composer (e.g. from the dashboard ?q= param). */
  initialQuery?: string;
  /**
   * The conversation to open, from the /chat/[conversationId] route. When set,
   * its saved messages are loaded so the chat can be viewed and continued.
   * Omit/null for a brand-new conversation on /ask.
   */
  conversationId?: string | null;
}

/**
 * The AI chat surface: empty state with examples, message list, and composer.
 * Owns chat state via the useChat hook and handles copy/save/feedback.
 *
 * Conversation persistence: when `conversationId` is provided (direct URL access
 * or refresh) the saved messages are loaded from the backend; when the first
 * message of a new chat creates a conversation, the URL is replaced with
 * /chat/{id} so a refresh reloads the same conversation.
 */
export function ChatWindow({ initialQuery, conversationId }: ChatWindowProps) {
  const {
    messages,
    isPending,
    send,
    save,
    reset,
    fetchConversation,
    conversationId: activeConversationId,
  } = useChat();
  const router = useRouter();
  const pathname = usePathname();

  const [input, setInput] = useState(initialQuery ?? "");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks which route conversation id has already been hydrated, so navigating
  // /ask -> /chat/{id} right after creating a conversation does not reload (and
  // wipe) the messages we just rendered, and so React StrictMode's double effect
  // run does not fire a second fetch.
  const loadedRef = useRef<string | null | undefined>(undefined);
  // Mirrors the conversation the UI is currently showing. Async responses compare
  // against it so a late response for a conversation the user already left can
  // neither overwrite the store nor clear/stray the loading state (this is what
  // previously left the UI stuck on "Loading conversation..." under StrictMode).
  const routeIdRef = useRef<string | null>(null);
  // Bumped by the retry button to re-run the load effect.
  const [reloadNonce, setReloadNonce] = useState(0);

  const startLoad = useCallback(
    (routeId: string) => {
      setLoadingHistory(true);
      setHistoryError(null);
      fetchConversation(routeId)
        .then(({ id, messages: loaded }) => {
          // Race guard: the user may have switched conversations while this
          // request was in flight — only apply the response if it is still the
          // selected conversation.
          if (routeIdRef.current !== id) return;
          chatStore.loadConversation(id, loaded);
        })
        .catch((err) => {
          if (routeIdRef.current !== routeId) return;
          setHistoryError(toErrorMessage(err));
        })
        .finally(() => {
          // Always end the loading state for the conversation still selected,
          // on success AND on error. No cleanup flag is involved, so StrictMode
          // remounts can no longer strand the spinner.
          if (routeIdRef.current === routeId) setLoadingHistory(false);
        });
    },
    [fetchConversation]
  );

  // Load the routed conversation (or start fresh on /ask).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- loading/error/reset
       are driven by an async fetch that must start when the route id changes. */
    const routeId = conversationId ?? null;
    routeIdRef.current = routeId;
    // TEMP-UI-DIAG (remove after verification): proves which id the UI selected.
    console.log("[TEMP-UI-DIAG] selected conversation:", routeId);
    if (loadedRef.current === routeId) return;
    loadedRef.current = routeId;

    if (routeId) {
      // Already hydrated (e.g. just created from /ask) — keep in-memory messages.
      if (routeId === activeConversationId && messages.length > 0) {
        return;
      }
      startLoad(routeId);
    } else if (activeConversationId !== null || messages.length > 0) {
      // Fresh /ask view: clear any previously opened conversation.
      reset();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Only re-run when the route's conversation id changes (or manual retry).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, reloadNonce]);

  // After the first message creates a conversation on /ask, move to its
  // permanent URL so a browser refresh reloads the same conversation.
  useEffect(() => {
    if (activeConversationId && pathname === "/ask") {
      router.replace(`/chat/${activeConversationId}`);
    }
  }, [activeConversationId, pathname, router]);

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

  const handleNewChat = useCallback(() => {
    reset();
    setInput("");
    setHistoryError(null);
    loadedRef.current = null;
    if (pathname !== "/ask") router.push("/ask");
  }, [reset, pathname, router]);

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
            onClick={handleNewChat}
            className="gap-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            New chat
          </Button>
        ) : null}
      </div>

      {/* Messages / loading / error / empty state */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loadingHistory ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <span className="size-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading conversation…</p>
          </div>
        ) : historyError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Unable to load this conversation
            </p>
            <p className="max-w-sm text-sm text-slate-500">{historyError}</p>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  loadedRef.current = undefined;
                  setHistoryError(null);
                  setReloadNonce((n) => n + 1);
                }}
              >
                Try again
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
              >
                Start new chat
              </Button>
            </div>
          </div>
        ) : hasMessages ? (
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
