/**
 * Date + time formatting helpers shared across the employee experience.
 */

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const DATE_TIME_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function toDate(value: string | number | Date | undefined | null): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(
  value: string | number | Date | undefined | null
): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-US", DATE_FMT) : "—";
}

export function formatDateTime(
  value: string | number | Date | undefined | null
): string {
  const d = toDate(value);
  return d ? d.toLocaleString("en-US", DATE_TIME_FMT) : "—";
}

export function formatRelativeTime(
  value: string | number | Date | undefined | null
): string {
  const d = toDate(value);
  if (!d) return "—";

  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(d);
}

/** "Good morning" / "Good afternoon" / "Good evening" based on local time. */
export function getGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** First name from a full name, used in the dashboard greeting. */
export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  const first = fullName.trim().split(/\s+/)[0];
  return first || "there";
}

/** Initials for avatar fallbacks (max 2 characters). */
export function getInitials(
  name: string | null | undefined,
  email?: string | null
): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "U";

  const parts = source.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
