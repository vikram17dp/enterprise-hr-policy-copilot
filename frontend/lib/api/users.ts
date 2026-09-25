import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
import type { EmployeeStats, UserProfile } from "@/types/user";

/**
 * GET /api/v1/users/me — returns { id, email, full_name, role }.
 * The database is the authoritative source of the user's role.
 */
export async function getMyProfile(): Promise<UserProfile> {
  const data = await apiFetch(`${API_V1}/users/me`, {
    method: "GET",
  });

  return data as UserProfile;
}

/**
 * PUT /api/v1/users/me — updates editable profile fields (full name only;
 * email and role are managed by Supabase / the database and are read-only).
 */
export async function updateMyProfile(
  updates: { full_name: string }
): Promise<UserProfile> {
  return (await apiFetch(`${API_V1}/users/me`, {
    method: "PUT",
    body: JSON.stringify(updates),
  })) as UserProfile;
}

/**
 * GET /api/v1/users/me/stats — real aggregated counts for the dashboard.
 */
export async function getEmployeeStats(): Promise<EmployeeStats> {
  return (await apiFetch(`${API_V1}/users/me/stats`, {
    method: "GET",
  })) as EmployeeStats;
}

/**
 * Changes the signed-in user's password via Supabase Auth (the existing,
 * authoritative auth system). No backend endpoint required.
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
