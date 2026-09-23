import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Professional error state with an optional "Try again" action.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/60 px-6 py-14 text-center",
        className
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-100">
        <AlertCircle className="size-6 text-red-600" aria-hidden />
      </div>

      <h3 className="text-base font-semibold text-slate-900">{title}</h3>

      {message ? (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-600">
          {message}
        </p>
      ) : null}

      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="mt-5 h-9 rounded-lg border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export default ErrorState;
