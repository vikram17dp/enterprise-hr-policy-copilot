import { createClient } from "@/lib/supabase/client";
import { apiFetch, withMockFallback } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
import { mockStats } from "@/lib/api/mockData";
import type { EmployeeStats, UserProfile } from "@/types/user";

/**
 * GET /api/v1/users/me — IMPLEMENTED on the backend.
 * Returns { id, email, full_name, role }.
 */
export async function getMyProfile(): Promise<UserProfile> {
  const data = await apiFetch(`${API_V1}/users/me`, {
    method: "GET",
  });

  return data as UserProfile;
}

/**
 * PUT /api/v1/users/me — NOT implemented yet.
 * Updates the editable profile fields (currently full name only; email and
 * role are managed by Supabase / the database and are read-only here).
 */
export async function updateMyProfile(
  updates: { full_name: string }
): Promise<UserProfile> {
  return withMockFallback(
    "PUT /users/me",
    async () =>
      (await apiFetch(`${API_V1}/users/me`, {
        method: "PUT",
        body: JSON.stringify(updates),
      })) as UserProfile,
    async () => {
      // Mock fallback: merge into the live profile so the UI stays coherent.
      const current = await getMyProfile().catch<UserProfile | null>(
        () => null
      );
      return {
        id: current?.id ?? "mock-user",
        email: current?.email ?? "employee@company.com",
        full_name: updates.full_name,
        role: current?.role ?? "employee",
      } satisfies UserProfile;
    }
  );
}

/**
 * GET /api/v1/users/me/stats — NOT implemented yet.
 * Aggregated counts for the dashboard stat cards.
 */
export async function getEmployeeStats(): Promise<EmployeeStats> {
  return withMockFallback(
    "GET /users/me/stats",
    async () =>
      (await apiFetch(`${API_V1}/users/me/stats`, {
        method: "GET",
      })) as EmployeeStats,
    () => ({ ...mockStats })
  );
}

/**
 * Changes the signed-in user's password via Supabase Auth (the existing,
 * authoritative auth system). No new backend endpoint required.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}
