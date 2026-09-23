import { createClient } from "@/lib/supabase/client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");

  if (session?.access_token) {
    headers.set(
      "Authorization",
      `Bearer ${session.access_token}`
    );
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail || "Something went wrong. Please try again."
    );
  }

  return data;
}

/**
 * Attempts the real backend call and, ONLY when the endpoint is not
 * implemented yet (404/405/501) or unreachable, falls back to clearly
 * marked mock data. See lib/api/mockData.ts for the required-endpoint list.
 *
 * This is a temporary development convenience so the employee UI is fully
 * usable before the backend endpoints exist. It never masks genuine
 * application errors (400/401/403/422/500) — those are rethrown.
 */
export async function withMockFallback<T>(
  label: string,
  realCall: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    return await realCall();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isMissingEndpoint =
      /404|405|501|not found|not implemented|method not allowed|failed to fetch|load failed|networkerror/i.test(
        message
      );

    if (isMissingEndpoint) {
      console.warn(
        `[api] "${label}" is not available on the backend yet — using mock fallback.`
      );
      return await fallback();
    }

    throw err;
  }
}