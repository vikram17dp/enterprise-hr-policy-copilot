import { createClient } from "@/lib/supabase/client";
import { apiFetch, apiUpload } from "@/lib/api/client";
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

/* ------------------------------- avatar -------------------------------- */

/** Mirrors the server-side limits in backend/app/api/v1/endpoints/users.py. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validate a candidate profile image on the client BEFORE uploading. Returns an
 * error message string, or null when the file is acceptable. The backend
 * re-validates authoritatively.
 */
export function validateAvatarFile(file: File | null | undefined): string | null {
  if (!file) return "Please choose an image file.";
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return "Unsupported format. Please choose a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Image is too large. Please choose a file under 5 MB.";
  }
  if (file.size === 0) {
    return "The selected file is empty.";
  }
  return null;
}

/**
 * POST /api/v1/users/me/avatar — uploads the image to the backend, which stores
 * it in Cloudinary and saves ONLY the returned secure URL on the user's profile.
 * Returns the updated profile.
 */
export async function uploadAvatar(file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append("file", file);

  return (await apiUpload(`${API_V1}/users/me/avatar`, formData)) as UserProfile;
}
