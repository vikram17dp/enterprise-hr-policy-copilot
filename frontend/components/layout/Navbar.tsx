"use client";

import Link from "next/link";
import {
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  User as UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { APP_NAME } from "@/lib/utils/constants";

interface NavbarProps {
  onMenuClick: () => void;
}

/**
 * Slim top bar for the main content area: mobile menu trigger, help shortcut,
 * and the user menu. Page titles/descriptions are rendered by each page via
 * the shared PageHeader.
 */
export function Navbar({ onMenuClick }: NavbarProps) {
  const { fullName, email, role } = useUser();
  const { signOut } = useAuth();

  const roleLabel = role === "admin" ? "Administrator" : "Employee";

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-6">
      {/* Left: mobile menu + wordmark */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </Button>

        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            H
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            {APP_NAME}
          </span>
        </Link>
      </div>

      {/* Right: help + user menu */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help and support"
          title="Help & Support"
          render={<Link href="/feedback" />}
          // Rendered as a Next.js <Link> (an <a>), not a native <button>.
          // Base UI requires nativeButton={false} so it applies correct link
          // semantics instead of expecting a real <button> element.
          nativeButton={false}
          className="text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <HelpCircle className="size-5" aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
            <UserAvatar name={fullName} email={email} size="sm" />
            <span className="hidden text-sm font-medium text-slate-700 sm:block">
              {fullName || "Employee"}
            </span>
            <ChevronDown className="size-4 text-slate-400" aria-hidden />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5">
                <span className="block text-sm font-medium text-slate-900">
                  {fullName || "Employee"}
                </span>
                <span className="block truncate text-xs font-normal text-slate-500">
                  {email}
                </span>
                <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  {roleLabel}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuItem render={<Link href="/profile" />}>
              <UserIcon className="size-4" aria-hidden />
              My Profile
            </DropdownMenuItem>

            <DropdownMenuItem render={<Link href="/feedback" />}>
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
    </header>
  );
}

export default Navbar;
