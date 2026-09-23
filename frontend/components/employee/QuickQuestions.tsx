"use client";

import { ArrowUpRight } from "lucide-react";

import { QUICK_QUESTIONS } from "@/lib/utils/constants";

interface QuickQuestionsProps {
  onSelect: (question: string) => void;
}

/**
 * Suggested questions on the dashboard. Selecting one navigates to /ask
 * with the question prefilled.
 */
export function QuickQuestions({ onSelect }: QuickQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_QUESTIONS.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onSelect(question)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          {question}
          <ArrowUpRight
            className="size-3.5 text-slate-300 transition-colors group-hover:text-blue-500"
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

export default QuickQuestions;
