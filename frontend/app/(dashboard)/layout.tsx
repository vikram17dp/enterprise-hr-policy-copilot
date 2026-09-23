import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

/**
 * Route group layout for all employee pages under (dashboard):
 * /dashboard, /ask, /conversations, /saved-answers, /documents,
 * /feedback, /profile.
 *
 * Wraps every employee route in auth/role protection and the shared
 * dashboard chrome.
 */
export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute allowedRole="employee">
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}
