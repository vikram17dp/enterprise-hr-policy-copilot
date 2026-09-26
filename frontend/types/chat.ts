/**
 * Chat types mirror the backend RAG graph output.
 * See backend/app/rag/state.py (AgentState) and workflow.py — a fixed nine-node
 * graph (Router -> Pinecone -> Grade KB -> [KB Answer | Tavily -> Grade Web ->
 * (Web Answer | Rewrite & Retry)] -> Final Answer) which returns:
 *   { answer, answer_source, source_used, execution_trace,
 *     sources/citations: [{ title, type, url, document?, chunk_id?, score? |
 *     domain? }] }
 */

export type CitationType =
  | "company_knowledge_base"
  | "web"
  | string;

/** Where the final answer came from. */
export type AnswerSourceKind = "kb" | "web" | "insufficient" | string;

export interface Citation {
  title: string;
  url: string;
  type: CitationType;
  /** Internal KB document name (e.g. "company_hr_handbook.md"). */
  document?: string;
  /** Stable chunk locator (document + start index). */
  chunk_id?: string;
  /** Normalized 0-1 relevance of this chunk to the question. */
  relevance_score?: number;
  /** Alias of relevance_score (backend response shape). */
  score?: number;
  /** Web source domain (external answers). */
  domain?: string;
}

/** Precise source attribution returned alongside `citations`. */
export interface AnswerSource {
  title?: string;
  type?: CitationType;
  url?: string | null;
  /** Internal KB fields. */
  document?: string;
  chunk_id?: string;
  score?: number | null;
  /** Web field. */
  domain?: string;
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
  /** The persisted message id returned by the backend (assistant messages). */
  serverId?: string;
  /** Where the answer came from: "kb" | "web" | "insufficient". */
  answerSource?: AnswerSourceKind;
  /** The workflow decision/execution trace (assistant messages). */
  executionTrace?: string[];
}

/** Payload returned by POST /api/v1/chat/ask. */
export interface ChatAnswer {
  answer: string;
  /** Alias of answer_source kept for existing consumers. */
  source_used: string;
  citations: Citation[];
  /** Present so the client can continue the same conversation. */
  conversation_id?: string;
  /** The persisted assistant message id. */
  message_id?: string;
  /** Where the answer came from: "kb" | "web" | "insufficient". */
  answer_source?: AnswerSourceKind;
  /** The workflow decision/execution trace. */
  execution_trace?: string[];
  /** Precise contributing sources. */
  sources?: AnswerSource[];
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
