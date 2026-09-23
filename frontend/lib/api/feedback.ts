import { apiFetch, withMockFallback } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
import type { FeedbackPayload } from "@/types/chat";

export interface FeedbackResult {
  id: string;
  status: "received";
}

/**
 * POST /api/v1/feedback — NOT implemented yet.
 * Submits the employee experience feedback (rating + category + comment).
 */
export async function submitFeedback(
  payload: FeedbackPayload
): Promise<FeedbackResult> {
  return withMockFallback(
    "POST /feedback",
    async () =>
      (await apiFetch(`${API_V1}/feedback`, {
        method: "POST",
        body: JSON.stringify(payload),
      })) as FeedbackResult,
    async () => {
      await new Promise((r) => setTimeout(r, 500));
      return {
        id: `fb_${Date.now().toString(36)}`,
        status: "received" as const,
      };
    }
  );
}
