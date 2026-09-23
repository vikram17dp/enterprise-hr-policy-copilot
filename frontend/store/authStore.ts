"use client";

/**
 * Auth store — a dependency-free external store (useSyncExternalStore).
 *
 * Supabase remains the single source of authentication truth. This store
 * simply mirrors the Supabase session and enriches it with the backend
 * profile (GET /api/v1/users/me), which holds the authoritative role.
 */

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { getMyProfile } from "@/lib/api/users";
import type { UserProfile } from "@/types/user";
import type { AuthStatus } from "@/types/auth";

export interface AuthStoreState {
  status: AuthStatus;
  session: Session | null;
  profile: UserProfile | null;
}

let state: AuthStoreState = {
  status: "loading",
  session: null,
  profile: null,
};

const listeners = new Set<() => void>();
let initialized = false;

function setState(patch: Partial<AuthStoreState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthStoreState {
  return state;
}

async function applySession(session: Session | null): Promise<void> {
  if (!session) {
    setState({ status: "unauthenticated", session: null, profile: null });
    return;
  }

  setState({ status: "authenticated", session });

  try {
    const profile = await getMyProfile();
    setState({ profile });
  } catch {
    // Session is valid but the backend profile is unavailable (e.g. not yet
    // synced). Stay authenticated; role-gated UI treats a null role safely.
    setState({ profile: null });
  }
}

/**
 * Initializes the Supabase session listener exactly once. Safe to call from
 * multiple hooks/components.
 */
export function initAuthStore(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const supabase = createClient();

  supabase.auth.getSession().then(({ data }) => {
    void applySession(data.session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    void applySession(session);
  });
}

export async function signOutUser(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  setState({ status: "unauthenticated", session: null, profile: null });
}

/** Update the cached profile (e.g. after a successful profile edit). */
export function setCachedProfile(profile: UserProfile | null): void {
  setState({ profile });
}

export function useAuthStore(): AuthStoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
