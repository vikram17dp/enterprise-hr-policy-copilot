import { OverviewView } from "@/components/admin/views/OverviewView";

/**
 * Route: /admin/dashboard — alias for the /admin overview. The login flow
 * routes administrators here; it renders the same overview as /admin.
 */
export default function AdminDashboardPage() {
  return <OverviewView />;
}
