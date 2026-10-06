"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ChevronsUpDown,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/Avatar";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_NAV, APP_NAME } from "@/lib/utils/constants";
import { cn } from "@/lib/utils/cn";

/** `/admin/dashboard` is an alias for the `/admin` overview. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AdminSidebarPanelProps {
  onNavigate?: () => void;
}

/**
 * Admin navigation panel: brand block, the eight admin destinations, a link
 * back to the employee view, and the account menu. Shared by the fixed desktop
 * sidebar and the mobile sheet so navigation stays identical across breakpoints.
 */
export function AdminSidebarPanel({ onNavigate }: AdminSidebarPanelProps) {
  const pathname = usePathname();
  const { fullName, email, avatarUrl } = useUser();
  const { signOut } = useAuth();

  return (
    <div className="flex h-full flex-col bg-[#0b1220]">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
          H
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight text-white">
            {APP_NAME}
          </p>
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-indigo-300/80">
            <ShieldCheck className="size-3" aria-hidden />
            Admin Console
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Management
        </p>
        <ul className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60",
                    active
                      ? "bg-indigo-500/15 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {active ? (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-indigo-400"
                      aria-hidden
                    />
                  ) : null}
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0",
                      active
                        ? "text-indigo-300"
                        : "text-slate-500 group-hover:text-slate-300"
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Back to employee view */}
      <div className="px-3 pb-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <ArrowLeftRight className="size-[18px] text-slate-500" aria-hidden />
          Employee view
        </Link>
      </div>

      {/* Account */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60">
            <UserAvatar
              name={fullName}
              email={email}
              src={avatarUrl}
              tone="dark"
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">
                {fullName || "Administrator"}
              </span>
              <span className="block truncate text-xs text-slate-500">
                Administrator
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-500" aria-hidden />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" side="top" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5">
                <span className="block text-sm font-medium text-slate-900">
                  {fullName || "Administrator"}
                </span>
                <span className="block truncate text-xs font-normal text-slate-500">
                  {email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuItem render={<Link href="/admin/profile" onClick={onNavigate} />}>
              <ShieldCheck className="size-4" aria-hidden />
              Admin profile
            </DropdownMenuItem>

            <DropdownMenuItem render={<Link href="/dashboard" onClick={onNavigate} />}>
              <ArrowLeftRight className="size-4" aria-hidden />
              Employee view
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Fixed desktop admin sidebar (hidden below the lg breakpoint). */
export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
      <AdminSidebarPanel />
    </aside>
  );
}

export default AdminSidebar;
