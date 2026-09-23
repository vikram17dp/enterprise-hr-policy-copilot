import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface LoadingScreenProps {
  label?: string;
  className?: string;
}

/**
 * Full-area loading state used while auth resolves or a page fetches.
 */
export function LoadingScreen({
  label = "Loading...",
  className,
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[60vh] w-full flex-col items-center justify-center gap-3",
        className
      )}
    >
      <Loader2 className="size-6 animate-spin text-blue-600" aria-hidden />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default LoadingScreen;
