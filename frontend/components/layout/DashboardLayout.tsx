"use client";

import { useState, type ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { Navbar } from "@/components/layout/Navbar";

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Global employee layout: fixed navy sidebar on desktop, sheet navigation on
 * mobile, a slim top navbar, and a centered content region.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Navbar onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
