"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  HelpCircle,
  LogOut,
  User as UserIcon,
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
import { APP_NAME, EMPLOYEE_NAV } from "@/lib/utils/constants";
import { cn } from "@/lib/utils/cn";

interface SidebarPanelProps {
  /** Called after a nav item is selected (used to close the mobile sheet). */
  onNavigate?: () => void;
}

/**
 * The full sidebar content: logo, navigation, help, and the user section.
 * Shared by the fixed desktop Sidebar and the mobile MobileSidebar sheet.
 */
export function SidebarPanel({ onNavigate }: SidebarPanelProps) {
  const pathname = usePathname();
  const { fullName, email, role } = useUser();
  const { signOut } = useAuth();

  const roleLabel = role === "admin" ? "Administrator" : "Employee";

  return (
    <div className="flex h-full flex-col bg-[#0b1220]">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          H
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight text-white">
            {APP_NAME}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Employee
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Employee"
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Menu
        </p>
        <ul className="space-y-1">
          {EMPLOYEE_NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
                    active
                      ? "bg-blue-600/15 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {active ? (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-500"
                      aria-hidden
                    />
                  ) : null}
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0",
                      active
                        ? "text-blue-400"
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

      {/* Help & support */}
      <div className="px-3 pb-3">
        <Link
          href="/feedback"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <HelpCircle className="size-[18px] text-slate-500" aria-hidden />
          Help &amp; Support
        </Link>
      </div>

      {/* User section */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <UserAvatar
              name={fullName}
              email={email}
              tone="dark"
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">
                {fullName || "Employee"}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {roleLabel}
              </span>
            </span>
            <ChevronsUpDown
              className="size-4 shrink-0 text-slate-500"
              aria-hidden
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="top"
            className="min-w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5">
                <span className="block text-sm font-medium text-slate-900">
                  {fullName || "Employee"}
                </span>
                <span className="block truncate text-xs font-normal text-slate-500">
                  {email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              render={
                <Link href="/profile" onClick={onNavigate} />
              }
            >
              <UserIcon className="size-4" aria-hidden />
              My Profile
            </DropdownMenuItem>

            <DropdownMenuItem
              render={
                <Link href="/feedback" onClick={onNavigate} />
              }
            >
              <HelpCircle className="size-4" aria-hidden />
              Help &amp; Support
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              render={<button type="button" onClick={() => void signOut()} />}
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

/**
 * Fixed desktop sidebar. Hidden below the lg breakpoint, where the
 * MobileSidebar sheet takes over.
 */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
      <SidebarPanel />
    </aside>
  );
}

export default Sidebar;
