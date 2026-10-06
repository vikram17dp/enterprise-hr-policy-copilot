"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/shared/LoadingScreen";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Guards every /admin route. The authoritative role comes from the backend
 * profile (GET /users/me), never from the client. Unauthenticated visitors go
 * to /login; authenticated non-admins are redirected to the employee dashboard.
 *
 * This is defense-in-depth for the UI only — the backend independently enforces
 * role='admin' on every /api/v1/admin/* call (require_admin), so hiding routes
 * here is never the actual security boundary.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { status, profile } = useAuth();
  const router = useRouter();

  const isNonAdmin = status === "authenticated" && profile?.role !== "admin";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (isNonAdmin) {
      router.replace("/dashboard");
    }
  }, [isNonAdmin, router]);

  if (status === "loading") {
    return <LoadingScreen label="Verifying administrator access..." />;
  }

  if (status === "unauthenticated") {
    return <LoadingScreen label="Redirecting to sign in..." />;
  }

  // A valid session whose profile hasn't resolved yet (role unknown) is treated
  // as not-yet-authorized rather than granted access.
  if (isNonAdmin || !profile) {
    return <LoadingScreen label="Redirecting..." />;
  }

  return <>{children}</>;
}

export default AdminRoute;
