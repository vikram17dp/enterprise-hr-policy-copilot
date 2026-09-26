import { createClient } from "@/lib/supabase/client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Thin authenticated fetch wrapper for the FastAPI backend.
 *
 * - Attaches the Supabase access token as a Bearer token (the backend
 *   verifies it against the Supabase JWKS).
 * - Parses JSON responses and surfaces the backend's `detail` message on
 *   error so the UI can show a useful, real message.
 *
 * There is intentionally NO mock fallback: if the backend is unavailable or
 * returns an error, it throws, and the calling UI shows its error state.
 */
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

  // 204 No Content (e.g. DELETE) has an empty body.
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail || "Something went wrong. Please try again."
    );
  }

  return data;
}

/**
 * Authenticated multipart/form-data upload for the FastAPI backend.
 *
 * Same auth + error handling as `apiFetch`, but it deliberately does NOT set a
 * Content-Type header — the browser must generate the `multipart/form-data`
 * boundary itself. Used for the profile-picture (Cloudinary) upload.
 */
export async function apiUpload(endpoint: string, formData: FormData) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers();

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail || "Upload failed. Please try again."
    );
  }

  return data;
}
