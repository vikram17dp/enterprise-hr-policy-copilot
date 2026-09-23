import { apiFetch, withMockFallback } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
import {
  addMockSavedAnswer,
  deleteMockConversation,
  getMockChatAnswer,
  getMockConversations,
  getMockSavedAnswers,
  mockId,
  removeMockSavedAnswer,
} from "@/lib/api/mockData";
import type {
  ChatAnswer,
  ConversationDetail,
  ConversationSummary,
  SavedAnswer,
} from "@/types/chat";

export interface SaveAnswerInput {
  question: string;
  answer: string;
  source?: string | null;
  category?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}

/* --------------------------------- ask ---------------------------------- */

/**
 * POST /api/v1/chat/ask — NOT implemented yet.
 * Runs the agentic RAG workflow and returns { answer, source_used, citations }.
 */
export async function askQuestion(
  question: string,
  conversationId?: string | null
): Promise<ChatAnswer> {
  return withMockFallback(
    "POST /chat/ask",
    async () =>
      (await apiFetch(`${API_V1}/chat/ask`, {
        method: "POST",
        body: JSON.stringify({
          question,
          conversation_id: conversationId ?? undefined,
        }),
      })) as ChatAnswer,
    async () => {
      // Simulate a short "thinking" latency for a realistic UI.
      await new Promise((r) => setTimeout(r, 700));
      return getMockChatAnswer(question);
    }
  );
}

/* ----------------------------- conversations ---------------------------- */

/** GET /api/v1/conversations — NOT implemented yet. */
export async function getConversations(): Promise<ConversationSummary[]> {
  return withMockFallback(
    "GET /conversations",
    async () =>
      (await apiFetch(`${API_V1}/conversations`, {
        method: "GET",
      })) as ConversationSummary[],
    () => getMockConversations()
  );
}

/** GET /api/v1/conversations/{id} — NOT implemented yet. */
export async function getConversation(
  id: string
): Promise<ConversationDetail> {
  return withMockFallback(
    `GET /conversations/${id}`,
    async () =>
      (await apiFetch(`${API_V1}/conversations/${id}`, {
        method: "GET",
      })) as ConversationDetail,
    () => {
      const summary = getMockConversations().find((c) => c.id === id);
      const base = summary ?? {
        id,
        title: "Conversation",
        lastQuestion: null,
        messageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active" as const,
      };

      return {
        ...base,
        messages: base.lastQuestion
          ? [
              {
                id: mockId("msg"),
                role: "user",
                content: base.lastQuestion,
                createdAt: base.createdAt,
                status: "complete",
              },
            ]
          : [],
      } satisfies ConversationDetail;
    }
  );
}

/** DELETE /api/v1/conversations/{id} — NOT implemented yet. */
export async function deleteConversation(id: string): Promise<void> {
  return withMockFallback(
    `DELETE /conversations/${id}`,
    async () => {
      await apiFetch(`${API_V1}/conversations/${id}`, {
        method: "DELETE",
      });
    },
    () => deleteMockConversation(id)
  );
}

/* ----------------------------- saved answers ---------------------------- */

/** GET /api/v1/saved-answers — NOT implemented yet. */
export async function getSavedAnswers(): Promise<SavedAnswer[]> {
  return withMockFallback(
    "GET /saved-answers",
    async () =>
      (await apiFetch(`${API_V1}/saved-answers`, {
        method: "GET",
      })) as SavedAnswer[],
    () => getMockSavedAnswers()
  );
}

/** POST /api/v1/saved-answers — NOT implemented yet. */
export async function saveAnswer(
  input: SaveAnswerInput
): Promise<SavedAnswer> {
  return withMockFallback(
    "POST /saved-answers",
    async () =>
      (await apiFetch(`${API_V1}/saved-answers`, {
        method: "POST",
        body: JSON.stringify(input),
      })) as SavedAnswer,
    () =>
      addMockSavedAnswer({
        question: input.question,
        answer: input.answer,
        source: input.source ?? null,
        category: input.category ?? null,
      })
  );
}

/** DELETE /api/v1/saved-answers/{id} — NOT implemented yet. */
export async function removeSavedAnswer(id: string): Promise<void> {
  return withMockFallback(
    `DELETE /saved-answers/${id}`,
    async () => {
      await apiFetch(`${API_V1}/saved-answers/${id}`, {
        method: "DELETE",
      });
    },
    () => removeMockSavedAnswer(id)
  );
}
