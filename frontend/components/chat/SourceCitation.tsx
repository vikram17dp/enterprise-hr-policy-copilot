import { ExternalLink, FileText, Globe } from "lucide-react";

import type { Citation } from "@/types/chat";

interface SourceCitationProps {
  citation: Citation;
  index: number;
}

function citationMeta(type: string) {
  if (type === "web") {
    return { label: "Web", Icon: Globe, className: "bg-sky-50 text-sky-700" };
  }
  return {
    label: "Source",
    Icon: FileText,
    className: "bg-blue-50 text-blue-700",
  };
}

/**
 * A single grounded source for an assistant answer.
 */
export function SourceCitation({ citation, index }: SourceCitationProps) {
  const { label, Icon, className } = citationMeta(citation.type);

  const content = (
    <>
      <span
        className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
      >
        <Icon className="size-3" aria-hidden />
        {label}
      </span>
      <span className="truncate text-[13px] text-slate-600">
        {citation.title}
      </span>
      {citation.url ? (
        <ExternalLink className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      ) : null}
    </>
  );

  return citation.url ? (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
      aria-label={`Source ${index + 1}: ${citation.title}`}
    >
      {content}
    </a>
  ) : (
    <div
      className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
      aria-label={`Source ${index + 1}: ${citation.title}`}
    >
      {content}
    </div>
  );
}

export default SourceCitation;
