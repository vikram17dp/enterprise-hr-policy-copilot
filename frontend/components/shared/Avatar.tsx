"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/formatDate";

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  /** "dark" renders light initials for use on the navy sidebar. */
  tone?: "light" | "dark";
  className?: string;
}

const sizeClasses: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-14 text-base",
};

/**
 * Shared user avatar with initials fallback. Used in the sidebar footer,
 * the top navbar, and the profile page.
 */
export function UserAvatar({
  name,
  email,
  src,
  size = "md",
  tone = "light",
  className,
}: UserAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {src ? <AvatarImage src={src} alt={name ?? "User avatar"} /> : null}
      <AvatarFallback
        aria-hidden
        className={cn(
          tone === "dark"
            ? "bg-white/10 font-semibold text-white"
            : "bg-blue-600/10 font-semibold text-blue-700"
        )}
      >
        {getInitials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}

export default UserAvatar;
