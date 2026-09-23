/* ============================================================================
 * TEMPORARY MOCK DATA — CLEARLY MARKED
 * ----------------------------------------------------------------------------
 * The backend currently implements ONLY:
 *   POST /api/v1/auth/sync-user
 *   GET  /api/v1/auth/me
 *   GET  /api/v1/users/me
 *
 * The following employee endpoints are NOT implemented yet and are REQUIRED:
 *   GET    /api/v1/users/me/stats
 *   PUT    /api/v1/users/me
 *   POST   /api/v1/users/me/password        (or use Supabase directly)
 *   POST   /api/v1/chat/ask
 *   GET    /api/v1/conversations
 *   GET    /api/v1/conversations/{id}
 *   DELETE /api/v1/conversations/{id}
 *   GET    /api/v1/saved-answers
 *   POST   /api/v1/saved-answers
 *   DELETE /api/v1/saved-answers/{id}
 *   GET    /api/v1/documents
 *   GET    /api/v1/documents/{id}
 *   POST   /api/v1/feedback
 *
 * The service functions in lib/api/*.ts attempt the REAL endpoint first and
 * only fall back to the in-memory data below when the backend is unavailable
 * (404/405/501/network). This keeps the UI fully usable for demos without
 * pretending the mock is production behavior. Remove this file once the
 * backend endpoints above are live.
 * ==========================================================================*/

import type {
  ChatAnswer,
  ConversationSummary,
  SavedAnswer,
} from "@/types/chat";
import type { PolicyDocument } from "@/types/document";
import type { EmployeeStats } from "@/types/user";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

let idCounter = 0;
export function mockId(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}_${now.toString(36)}_${idCounter}`;
}

/* ---------------------------------- stats -------------------------------- */

export const mockStats: EmployeeStats = {
  questionsAsked: 12,
  savedAnswers: 4,
  conversations: 6,
  documentsAvailable: 8,
};

/* ------------------------------ conversations ---------------------------- */

const conversations: ConversationSummary[] = [
  {
    id: mockId("conv"),
    title: "Work from home",
    lastQuestion: "Can I work from home permanently?",
    messageCount: 4,
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(5),
    status: "active",
  },
  {
    id: mockId("conv"),
    title: "Leave balance",
    lastQuestion: "How many vacation days do I have left?",
    messageCount: 2,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
    status: "active",
  },
  {
    id: mockId("conv"),
    title: "Medical reimbursement",
    lastQuestion: "How do I submit a medical reimbursement claim?",
    messageCount: 6,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(6),
    status: "active",
  },
];

export function getMockConversations(): ConversationSummary[] {
  return [...conversations].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  );
}

export function deleteMockConversation(id: string): void {
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx >= 0) conversations.splice(idx, 1);
}

/* ------------------------------ saved answers ---------------------------- */

const savedAnswers: SavedAnswer[] = [
  {
    id: mockId("saved"),
    question: "What is the work-from-home policy?",
    answer:
      "Employees may work from home up to 3 days per week with manager approval. Roles requiring on-site presence are defined in the policy document.",
    source: "Work From Home Policy v2.1.pdf",
    category: "Work From Home",
    savedAt: daysAgo(1),
  },
  {
    id: mockId("saved"),
    question: "How many vacation days do I get?",
    answer:
      "Full-time employees accrue 20 vacation days per year, increasing to 25 after five years of service.",
    source: "Leave Policy v3.0.pdf",
    category: "Leave",
    savedAt: daysAgo(3),
  },
];

export function getMockSavedAnswers(): SavedAnswer[] {
  return [...savedAnswers].sort(
    (a, b) => +new Date(b.savedAt) - +new Date(a.savedAt)
  );
}

export function addMockSavedAnswer(input: Omit<SavedAnswer, "id" | "savedAt">): SavedAnswer {
  const entry: SavedAnswer = {
    ...input,
    id: mockId("saved"),
    savedAt: new Date().toISOString(),
  };
  savedAnswers.unshift(entry);
  return entry;
}

export function removeMockSavedAnswer(id: string): void {
  const idx = savedAnswers.findIndex((s) => s.id === id);
  if (idx >= 0) savedAnswers.splice(idx, 1);
}

/* -------------------------------- documents ------------------------------ */

const documents: PolicyDocument[] = [
  {
    id: mockId("doc"),
    title: "Leave Policy",
    filename: "leave-policy-v3.pdf",
    description:
      "Annual, sick, and unpaid leave entitlements, accrual rules, and request procedures.",
    category: "Leave",
    version: 3,
    status: "ready",
    cloudinary_url: null,
    created_at: daysAgo(30),
    updated_at: daysAgo(3),
  },
  {
    id: mockId("doc"),
    title: "Work From Home Policy",
    filename: "work-from-home-policy-v2.1.pdf",
    description:
      "Eligibility, hybrid schedule guidelines, equipment, and security requirements for remote work.",
    category: "Work From Home",
    version: 2,
    status: "ready",
    cloudinary_url: null,
    created_at: daysAgo(60),
    updated_at: daysAgo(1),
  },
  {
    id: mockId("doc"),
    title: "Medical Reimbursement",
    filename: "medical-reimbursement-v1.pdf",
    description:
      "Coverage limits, eligible expenses, documentation, and the claim submission process.",
    category: "Benefits",
    version: 1,
    status: "ready",
    cloudinary_url: null,
    created_at: daysAgo(90),
    updated_at: daysAgo(12),
  },
  {
    id: mockId("doc"),
    title: "Code of Conduct",
    filename: "code-of-conduct-v4.pdf",
    description:
      "Professional behavior, anti-harassment, conflicts of interest, and disciplinary process.",
    category: "Compliance",
    version: 4,
    status: "ready",
    cloudinary_url: null,
    created_at: daysAgo(120),
    updated_at: daysAgo(20),
  },
  {
    id: mockId("doc"),
    title: "Maternity Leave Policy",
    filename: "maternity-leave-v2.pdf",
    description:
      "Parental leave duration, pay, phased return-to-work, and supporting documentation.",
    category: "Leave",
    version: 2,
    status: "ready",
    cloudinary_url: null,
    created_at: daysAgo(45),
    updated_at: daysAgo(8),
  },
];

export function getMockDocuments(): PolicyDocument[] {
  return [...documents].sort(
    (a, b) =>
      +new Date(b.updated_at ?? b.created_at) -
      +new Date(a.updated_at ?? a.created_at)
  );
}

export function getMockDocument(id: string): PolicyDocument | undefined {
  return documents.find((d) => d.id === id);
}

/* ---------------------------------- chat --------------------------------- */

export function getMockChatAnswer(question: string): ChatAnswer {
  const q = question.toLowerCase();

  let answer =
    `Here is a summarized answer to "${question}" based on your organization's HR ` +
    `knowledge base. This is temporary mock content because the chat endpoint is not ` +
    `implemented on the backend yet. Once POST /api/v1/chat/ask is available, the real ` +
    `grounded answer and citations will be shown here.`;

  let source = "HR Knowledge Base";

  if (q.includes("work from home") || q.includes("remote")) {
    answer =
      "Employees may work from home up to 3 days per week with prior manager approval. " +
      "Fully remote arrangements are evaluated case-by-case based on role requirements. " +
      "You must remain reachable during core hours (10:00–16:00) and follow the data " +
      "security guidelines when working off-site.";
    source = "Work From Home Policy v2.1.pdf";
  } else if (q.includes("vacation") || q.includes("leave") || q.includes("pto")) {
    answer =
      "Full-time employees accrue 20 vacation days per year, increasing to 25 after five " +
      "years of service. Leave requests should be submitted at least two weeks in advance " +
      "through the HR portal and are subject to manager approval.";
    source = "Leave Policy v3.0.pdf";
  } else if (q.includes("reimburs") || q.includes("medical") || q.includes("claim")) {
    answer =
      "To claim a medical reimbursement, submit the completed claim form along with original " +
      "receipts and a doctor's prescription within 90 days of the expense. Eligible expenses " +
      "are covered up to the annual limit defined in your benefits plan.";
    source = "Medical Reimbursement v1.pdf";
  } else if (q.includes("maternity") || q.includes("parental")) {
    answer =
      "Maternity leave provides up to 26 weeks of paid leave. A phased return-to-work option " +
      "is available for the first month back. Please notify HR at least 8 weeks before the " +
      "expected start date with supporting documentation.";
    source = "Maternity Leave Policy v2.pdf";
  }

  return {
    answer,
    source_used: "company_knowledge_base",
    citations: [
      { title: source, url: "", type: "company_knowledge_base" },
    ],
  };
}
