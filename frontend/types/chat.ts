/**
 * Chat types mirror the backend RAG graph output.
 * See backend/app/rag/state.py (AgentState) and workflow.py which returns:
 *   { answer, source_used, citations: [{ title, url, type }] }
 */

export type CitationType =
  | "company_knowledge_base"
  | "web"
  | string;

export interface Citation {
  title: string;
  url: string;
  type: CitationType;
}

export type MessageRole = "user" | "assistant";

export type MessageStatus = "pending" | "complete" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status?: MessageStatus;
  citations?: Citation[];
  sourceUsed?: string;
  error?: string;
  /** Set when the answer has been saved by the user. */
  saved?: boolean;
}

/** Payload returned by the ask/chat endpoint. */
export interface ChatAnswer {
  answer: string;
  source_used: string;
  citations: Citation[];
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  lastQuestion: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived";
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

export interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  source: string | null;
  category: string | null;
  savedAt: string;
}

export type FeedbackCategory =
  | "answer_accuracy"
  | "missing_information"
  | "incorrect_policy"
  | "user_experience"
  | "other";

export interface FeedbackPayload {
  rating: number;
  comment: string;
  category: FeedbackCategory;
}
