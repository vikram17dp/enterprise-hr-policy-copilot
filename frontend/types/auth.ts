import type { UserRole } from "./user";

/**
 * Minimal representation of a Supabase auth user as consumed by the
 * employee experience. We deliberately avoid depending on the full
 * @supabase/supabase-js types so these stay stable across the app.
 */
export interface AuthUser {
  id: string;
  email?: string | null;
  fullName?: string | null;
  role?: UserRole;
}

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  /** Supabase session access token presence flag. */
  hasSession: boolean;
  user: AuthUser | null;
}
