"use client";

import { useCallback, useEffect, useMemo } from "react";

import {
  initAuthStore,
  setCachedProfile,
  useAuthStore,
} from "@/store/authStore";
import { getMyProfile, updateMyProfile } from "@/lib/api/users";
import { getFirstName, getInitials } from "@/lib/utils/formatDate";
import type { UserProfile } from "@/types/user";

/**
 * Convenience hook over the auth store focused on the user's profile,
 * display name, initials, and role.
 */
export function useUser() {
  const { profile, status } = useAuthStore();

  useEffect(() => {
    initAuthStore();
  }, []);

  const refresh = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const next = await getMyProfile();
      setCachedProfile(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const updateProfile = useCallback(
    async (fullName: string): Promise<UserProfile> => {
      const updated = await updateMyProfile({ full_name: fullName });
      setCachedProfile(updated);
      return updated;
    },
    []
  );

  return useMemo(() => {
    const fullName = profile?.full_name ?? "";
    return {
      user: profile,
      role: profile?.role ?? null,
      fullName,
      firstName: getFirstName(profile?.full_name),
      initials: getInitials(profile?.full_name, profile?.email),
      email: profile?.email ?? "",
      isAdmin: profile?.role === "admin",
      isEmployee: profile?.role === "employee",
      isLoading: status === "loading",
      isReady: status !== "loading",
      refresh,
      updateProfile,
    };
  }, [profile, status, refresh, updateProfile]);
}
