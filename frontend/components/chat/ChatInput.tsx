"use client";

import { useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Chat composer. Enter sends, Shift+Enter inserts a newline. The textarea
 * auto-grows up to a max height.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask a question about HR policies...",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 transition-colors focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Message"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-40 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
        />
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="size-9 shrink-0 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <ArrowUp className="size-4" aria-hidden />
        </Button>
      </div>
      <p className="mt-2 px-1 text-[11px] text-slate-400">
        Answers are grounded in your organization&apos;s HR knowledge base.
        Press <kbd className="font-sans font-medium">Enter</kbd> to send.
      </p>
    </div>
  );
}

export default ChatInput;
