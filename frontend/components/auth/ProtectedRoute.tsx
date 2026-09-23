"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import type { UserRole } from "@/types/user";

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Role allowed to view this route. Employee routes redirect admins to
   * /admin/dashboard. The authoritative role comes from the backend profile
   * (GET /users/me), never from sessionStorage.
   */
  allowedRole?: UserRole;
}

/**
 * Guards employee routes. Redirects unauthenticated users to /login and
 * administrators away from employee-only areas.
 */
export function ProtectedRoute({
  children,
  allowedRole = "employee",
}: ProtectedRouteProps) {
  const { status, profile } = useAuth();
  const router = useRouter();

  const isAdminOnEmployeeRoute =
    allowedRole === "employee" && profile?.role === "admin";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && isAdminOnEmployeeRoute) {
      router.replace("/admin/dashboard");
    }
  }, [status, isAdminOnEmployeeRoute, router]);

  if (status === "loading") {
    return <LoadingScreen label="Loading your workspace..." />;
  }

  if (status === "unauthenticated") {
    return <LoadingScreen label="Redirecting to sign in..." />;
  }

  if (isAdminOnEmployeeRoute) {
    return <LoadingScreen label="Redirecting to admin workspace..." />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
