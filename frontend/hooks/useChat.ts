"use client";

import { useCallback, useMemo } from "react";

import { chatStore, useChatStore } from "@/store/chatStore";
import { askQuestion, saveAnswer } from "@/lib/api/chat";
import type { ChatMessage } from "@/types/chat";
import { toErrorMessage } from "@/types/api";

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Chat action layer over the chat store. Handles sending a question to the
 * RAG endpoint, tracking the pending assistant message, and saving answers.
 */
export function useChat() {
  const state = useChatStore();

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || state.isPending) return;

      const userMessage: ChatMessage = {
        id: makeId("u"),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        status: "complete",
      };

      const assistantId = makeId("a");
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        status: "pending",
      };

      chatStore.addMessage(userMessage);
      chatStore.addMessage(assistantMessage);
      chatStore.setPending(true);

      try {
        const result = await askQuestion(content, state.conversationId);
        chatStore.updateMessage(assistantId, {
          content: result.answer,
          citations: result.citations,
          sourceUsed: result.source_used,
          status: "complete",
        });
      } catch (err) {
        chatStore.updateMessage(assistantId, {
          status: "error",
          error: toErrorMessage(err),
        });
      } finally {
        chatStore.setPending(false);
      }
    },
    [state.isPending, state.conversationId]
  );

  const save = useCallback(
    async (message: ChatMessage, question: string) => {
      const source = message.citations?.[0]?.title ?? null;
      const saved = await saveAnswer({
        question,
        answer: message.content,
        source,
        category: null,
        conversationId: state.conversationId,
        messageId: message.id,
      });
      chatStore.updateMessage(message.id, { saved: true });
      return saved;
    },
    [state.conversationId]
  );

  const reset = useCallback(() => chatStore.reset(), []);

  return useMemo(
    () => ({
      messages: state.messages,
      isPending: state.isPending,
      conversationId: state.conversationId,
      send,
      save,
      reset,
    }),
    [state, send, save, reset]
  );
}
