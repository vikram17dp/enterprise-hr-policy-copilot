/**
 * Chat types mirror the backend RAG graph output.
 * See backend/app/rag/state.py (AgentState) and workflow.py which returns:
 *   { answer, intent, source_used, requires_employee_data, requires_action,
 *     citations: [{ title, url, type, document, chunk_id, relevance_score }],
 *     sources:   [{ document, chunk_id, relevance_score, type, url }] }
 */

export type CitationType =
  | "company_knowledge_base"
  | "web"
  | string;

/** The closed set of intents the backend classifier can return. */
export type ChatIntent =
  | "HR_POLICY"
  | "EMPLOYEE_SPECIFIC"
  | "COMPANY_CALENDAR"
  | "EXTERNAL_GENERAL"
  | "ACTION_REQUEST"
  | "GENERAL_CONVERSATION"
  | "CLARIFICATION_NEEDED"
  | string;

/** Which source produced the answer. */
export type SourceType =
  | "internal_kb"
  | "employee_data"
  | "company_calendar"
  | "web"
  | "none"
  | string;

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
  /** Classified intent for this answer (assistant messages). */
  intent?: ChatIntent;
  /** Which source produced the answer (assistant messages). */
  sourceType?: SourceType;
  /** True when a full answer needs the employee's own data (not yet available). */
  requiresEmployeeData?: boolean;
  /** True when the user asked the system to perform an action it cannot do yet. */
  requiresAction?: boolean;
}

/** Payload returned by POST /api/v1/chat/ask. */
export interface ChatAnswer {
  answer: string;
  source_used: string;
  citations: Citation[];
  /** Present so the client can continue the same conversation. */
  conversation_id?: string;
  /** The persisted assistant message id. */
  message_id?: string;
  /** Classified intent. */
  intent?: ChatIntent;
  /** Which source produced the answer. */
  source_type?: SourceType;
  /** Whether a full answer needs employee-specific data not yet available. */
  requires_employee_data?: boolean;
  /** Whether the request needs an action the system cannot perform yet. */
  requires_action?: boolean;
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
