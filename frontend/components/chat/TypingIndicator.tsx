/**
 * Animated "assistant is typing" indicator.
 */
export function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1.5 py-1"
      role="status"
      aria-label="Assistant is typing"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${i * 0.15}s` }}
          aria-hidden
        />
      ))}
    </div>
  );
}

export default TypingIndicator;
