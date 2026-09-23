import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const toneClasses: Record<Tone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

const statusToneMap: Record<string, Tone> = {
  ready: "success",
  active: "success",
  approved: "success",
  published: "success",
  complete: "success",
  completed: "success",
  processing: "warning",
  pending: "warning",
  in_progress: "warning",
  failed: "danger",
  error: "danger",
  rejected: "danger",
  archived: "neutral",
};

function labelize(status: string): string {
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusBadgeProps {
  status: string;
  tone?: Tone;
  className?: string;
}

/**
 * Colored badge that maps a backend status string to a consistent tone.
 */
export function StatusBadge({ status, tone, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? statusToneMap[status.toLowerCase()] ?? "neutral";

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        toneClasses[resolvedTone],
        className
      )}
    >
      {labelize(status)}
    </Badge>
  );
}

export default StatusBadge;
