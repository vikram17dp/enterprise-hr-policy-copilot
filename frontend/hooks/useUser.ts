"use client";

import { useCallback, useEffect, useMemo } from "react";

import {
  initAuthStore,
  setCachedProfile,
  useAuthStore,
} from "@/store/authStore";
import { getMyProfile, updateMyProfile, uploadAvatar } from "@/lib/api/users";
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

  const changeAvatar = useCallback(
    async (file: File): Promise<UserProfile> => {
      const updated = await uploadAvatar(file);
      // Updates the shared auth store, so the Navbar/Sidebar avatar refresh
      // immediately without a manual browser reload.
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
      avatarUrl: profile?.avatar_url ?? null,
      isAdmin: profile?.role === "admin",
      isEmployee: profile?.role === "employee",
      isLoading: status === "loading",
      isReady: status !== "loading",
      refresh,
      updateProfile,
      changeAvatar,
    };
  }, [profile, status, refresh, updateProfile, changeAvatar]);
}
