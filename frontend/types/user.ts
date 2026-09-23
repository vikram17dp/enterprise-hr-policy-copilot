/**
 * The application has exactly two roles. There is no "hr" role.
 */
export type UserRole = "employee" | "admin";

/**
 * Shape returned by GET /api/v1/users/me
 * (see backend/app/api/v1/endpoints/users.py).
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  /**
   * Present on the `users` table but not yet returned by GET /users/me.
   * Optional so the profile UI can show it once the backend exposes it.
   */
  created_at?: string;
}

/**
 * Shape returned by POST /api/v1/auth/sync-user.
 */
export interface SyncedUser extends UserProfile {
  auth_user_id: string;
}

/**
 * The `users` table also stores created_at (backend/app/models/user.py),
 * but the current /users/me endpoint does not return it. We keep it
 * optional so the profile UI can display it once the backend exposes it.
 */
export interface UserAccountInfo extends UserProfile {
  created_at?: string;
}

/**
 * Aggregated counts used by the dashboard stat cards.
 * Backed by GET /api/v1/users/me/stats (see lib/api/users.ts for the
 * required-endpoint note).
 */
export interface EmployeeStats {
  questionsAsked: number;
  savedAnswers: number;
  conversations: number;
  documentsAvailable: number;
}
