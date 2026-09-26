import { apiFetch } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
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
 * POST /api/v1/chat/ask — runs the real agentic RAG workflow (a fixed nine-node
 * LangGraph: Router -> Pinecone retrieve -> Grade KB -> [KB answer | Tavily web
 * search -> Grade Web -> (web answer | rewrite & retry)] -> Final Answer).
 * Returns { answer, conversation_id, message_id, answer_source, source_used,
 * sources, citations, execution_trace }.
 */
export async function askQuestion(
  message: string,
  conversationId?: string | null
): Promise<ChatAnswer> {
  return (await apiFetch(`${API_V1}/chat/ask`, {
    method: "POST",
    body: JSON.stringify({
      message,
      conversation_id: conversationId ?? undefined,
    }),
  })) as ChatAnswer;
}

/* ----------------------------- conversations ---------------------------- */

/** GET /api/v1/conversations */
export async function getConversations(): Promise<ConversationSummary[]> {
  return (await apiFetch(`${API_V1}/conversations`, {
    method: "GET",
  })) as ConversationSummary[];
}

/** GET /api/v1/conversations/{id} */
export async function getConversation(
  id: string
): Promise<ConversationDetail> {
  return (await apiFetch(`${API_V1}/conversations/${id}`, {
    method: "GET",
  })) as ConversationDetail;
}

/** DELETE /api/v1/conversations/{id} */
export async function deleteConversation(id: string): Promise<void> {
  await apiFetch(`${API_V1}/conversations/${id}`, {
    method: "DELETE",
  });
}

/* ----------------------------- saved answers ---------------------------- */

/** GET /api/v1/saved-answers */
export async function getSavedAnswers(): Promise<SavedAnswer[]> {
  return (await apiFetch(`${API_V1}/saved-answers`, {
    method: "GET",
  })) as SavedAnswer[];
}

/** POST /api/v1/saved-answers */
export async function saveAnswer(
  input: SaveAnswerInput
): Promise<SavedAnswer> {
  return (await apiFetch(`${API_V1}/saved-answers`, {
    method: "POST",
    body: JSON.stringify(input),
  })) as SavedAnswer;
}

/** DELETE /api/v1/saved-answers/{id} */
export async function removeSavedAnswer(id: string): Promise<void> {
  await apiFetch(`${API_V1}/saved-answers/${id}`, {
    method: "DELETE",
  });
}
