"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ADMIN_NAV, APP_NAME } from "@/lib/utils/constants";

interface AdminHeaderProps {
  onMenuClick: () => void;
}

function sectionLabel(pathname: string): string {
  const match = ADMIN_NAV.find((item) =>
    item.href === "/admin"
      ? pathname === "/admin" || pathname === "/admin/dashboard"
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return match?.label ?? "Admin";
}

/**
 * Slim top bar for the admin content region: a mobile menu trigger, the current
 * section name, and an "Admin Console" marker. Page-level titles/descriptions
 * are rendered by each view via the shared PageHeader.
 */
export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Open admin navigation menu"
          className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </Button>

        <Link href="/admin" className="flex items-center gap-2 lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">
            H
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            {APP_NAME}
          </span>
        </Link>

        <span className="hidden min-w-0 truncate text-sm font-medium text-slate-500 lg:block">
          Admin Console
          <span className="mx-2 text-slate-300" aria-hidden>
            /
          </span>
          <span className="font-semibold text-slate-800">
            {sectionLabel(pathname)}
          </span>
        </span>
      </div>

      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
        <ShieldCheck className="size-3.5" aria-hidden />
        Administrator
      </span>
    </header>
  );
}

export default AdminHeader;
