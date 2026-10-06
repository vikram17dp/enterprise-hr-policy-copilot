"use client";

import { useState, type ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileSidebar } from "@/components/admin/AdminMobileSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Global admin chrome: fixed navy sidebar on desktop, a sheet navigation drawer
 * on mobile, a slim top header, and a wide centered content region. Mirrors the
 * employee DashboardLayout so the two experiences feel consistent while keeping
 * the admin console visually distinct (indigo accents, wider max width).
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <AdminSidebar />
      <AdminMobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <AdminHeader onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
