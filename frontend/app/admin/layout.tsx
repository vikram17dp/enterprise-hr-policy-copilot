import type { ReactNode } from "react";

import { AdminRoute } from "@/components/auth/AdminRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";

/**
 * Layout for every /admin route. Wraps the admin console in:
 *  - AdminRoute: client-side, defense-in-depth role gate (the backend
 *    independently enforces role='admin' on every /api/v1/admin/* call).
 *  - AdminLayout: the shared sidebar + header + content chrome.
 */
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AdminRoute>
      <AdminLayout>{children}</AdminLayout>
    </AdminRoute>
  );
}
