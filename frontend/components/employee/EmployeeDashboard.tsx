"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/useUser";
import { getEmployeeStats } from "@/lib/api/users";
import { getConversations } from "@/lib/api/chat";
import { listDocuments } from "@/lib/api/documents";
import { ASK_QUERY_PARAM } from "@/lib/utils/constants";
import { getGreeting } from "@/lib/utils/formatDate";
import { toErrorMessage } from "@/types/api";
import type { ConversationSummary } from "@/types/chat";
import type { PolicyDocument } from "@/types/document";
import type { EmployeeStats as EmployeeStatsData } from "@/types/user";

import { EmployeeStats } from "./EmployeeStats";
import { QuickQuestions } from "./QuickQuestions";
import { RecentConversations } from "./RecentConversations";
import { PolicyHighlights } from "./PolicyHighlights";

/**
 * Employee dashboard: greeting, AI question box, quick questions, activity
 * stats, recent conversations, policy highlights, and a security note.
 */
export function EmployeeDashboard() {
  const router = useRouter();
  const { firstName } = useUser();

  const [question, setQuestion] = useState("");

  const [stats, setStats] = useState<EmployeeStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const load = useCallback(async (reset = false) => {
    if (reset) {
      setStatsLoading(true);
      setConvLoading(true);
      setDocsLoading(true);
      setConvError(null);
    }

    const [statsRes, convRes, docsRes] = await Promise.allSettled([
      getEmployeeStats(),
      getConversations(),
      listDocuments(),
    ]);

    if (statsRes.status === "fulfilled") setStats(statsRes.value);
    setStatsLoading(false);

    if (convRes.status === "fulfilled") {
      setConversations(convRes.value);
    } else {
      setConvError(toErrorMessage(convRes.reason));
    }
    setConvLoading(false);

    if (docsRes.status === "fulfilled") setDocuments(docsRes.value);
    setDocsLoading(false);
  }, []);

  useEffect(() => {
    // Async load-on-mount (reset=false): all setState runs after the awaited
    // Promise.allSettled, never synchronously during the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const goToAsk = useCallback(
    (value: string) => {
      const q = value.trim();
      router.push(
        q ? `/ask?${ASK_QUERY_PARAM}=${encodeURIComponent(q)}` : "/ask"
      );
    },
    [router]
  );

  const handleAsk = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    goToAsk(question);
  };

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
          {getGreeting()}, {firstName} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 sm:text-base">
          How can I help you today?
        </p>
      </div>

      {/* AI question box */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-blue-500/5 blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-slate-900">
              Ask the HR Copilot
            </p>
          </div>

          <form onSubmit={handleAsk} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about HR policies..."
                aria-label="Ask a question about HR policies"
                className="h-12 rounded-xl border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/15"
              />
            </div>
            <Button
              type="submit"
              className="h-12 shrink-0 gap-1.5 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-blue-500/30"
            >
              Ask
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </form>
        </div>
      </section>

      {/* Quick questions */}
      <section aria-label="Popular questions">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Popular questions
        </h2>
        <QuickQuestions onSelect={goToAsk} />
      </section>

      {/* Stats */}
      <EmployeeStats stats={stats} loading={statsLoading} />

      {/* Conversations + highlights */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentConversations
            conversations={conversations}
            loading={convLoading}
            error={convError}
            onRetry={() => void load(true)}
          />
        </div>
        <div className="lg:col-span-1">
          <PolicyHighlights documents={documents} loading={docsLoading} />
        </div>
      </div>

      {/* Security / AI information */}
      <section className="flex items-start gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Grounded, secure answers
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Answers are grounded in your organization&apos;s HR policy knowledge
            base. Your conversations are private and never used outside your
            workspace.
          </p>
        </div>
      </section>
    </div>
  );
}

export default EmployeeDashboard;
