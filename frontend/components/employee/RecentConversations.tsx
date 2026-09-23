"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, History, MessageSquareText } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { formatRelativeTime } from "@/lib/utils/formatDate";
import type { ConversationSummary } from "@/types/chat";

interface RecentConversationsProps {
  conversations: ConversationSummary[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Dashboard preview of the most recent conversations with a "View all" link.
 */
export function RecentConversations({
  conversations,
  loading,
  error,
  onRetry,
}: RecentConversationsProps) {
  const router = useRouter();
  const visible = conversations.slice(0, 4);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent Conversations
          </h2>
        </div>
        <Link
          href="/conversations"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          View all
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="p-2">
        {loading ? (
          <ul className="space-y-1 p-1">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 rounded-lg px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <ErrorState
            title="Unable to load conversations"
            message={error}
            onRetry={onRetry}
            className="border-0 bg-transparent py-8"
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={History}
            title="No conversations yet"
            description="Questions you ask will appear here so you can pick up where you left off."
            actionLabel="Ask your first question"
            onAction={() => router.push("/ask")}
            className="border-0 py-8"
          />
        ) : (
          <ul className="space-y-1">
            {visible.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href="/conversations"
                  className="group flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                      <MessageSquareText className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {conversation.lastQuestion ??
                          conversation.title ??
                          "Conversation"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatRelativeTime(conversation.updatedAt)}
                        {" · "}
                        {conversation.messageCount} messages
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={conversation.status} />
                    <ArrowRight
                      className="size-4 text-slate-300 transition-colors group-hover:text-blue-500"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default RecentConversations;
