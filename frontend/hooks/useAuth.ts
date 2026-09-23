"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  initAuthStore,
  signOutUser,
  useAuthStore,
} from "@/store/authStore";
import { toErrorMessage } from "@/types/api";

/**
 * Primary auth hook for the employee experience.
 * Supabase is the source of truth; this hook mirrors session + profile.
 */
export function useAuth() {
  const state = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    initAuthStore();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutUser();
      toast.success("Signed out", {
        description: "You have been logged out securely.",
      });
      router.replace("/login");
    } catch (err) {
      toast.error("Unable to sign out", {
        description: toErrorMessage(err),
      });
    }
  }, [router]);

  return useMemo(
    () => ({
      status: state.status,
      session: state.session,
      profile: state.profile,
      isLoading: state.status === "loading",
      isAuthenticated: state.status === "authenticated",
      signOut,
    }),
    [state, signOut]
  );
}
