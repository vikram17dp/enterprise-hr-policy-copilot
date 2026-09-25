import { apiFetch } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
import type { FeedbackPayload } from "@/types/chat";

export interface FeedbackResult {
  id: string;
  status: "received";
}

/**
 * POST /api/v1/feedback — submits employee experience feedback
 * (rating 1-5 + category + optional comment).
 */
export async function submitFeedback(
  payload: FeedbackPayload
): Promise<FeedbackResult> {
  return (await apiFetch(`${API_V1}/feedback`, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as FeedbackResult;
}
