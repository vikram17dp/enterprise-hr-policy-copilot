import { redirect } from "next/navigation";

/**
 * Route: /admin/documents — legacy placeholder. Policy/document management now
 * lives at /admin/policies, so this redirects there.
 */
export default function AdminDocumentsPage() {
  redirect("/admin/policies");
}
