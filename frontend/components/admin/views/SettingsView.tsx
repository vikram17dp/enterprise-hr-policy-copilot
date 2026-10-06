"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Bot,
  Database,
  Wrench,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { useApi } from "@/hooks/useApi";
import {
  getSettings,
  updateSettings,
  clearCache,
  reindexPolicies,
  getAdminHealth,
} from "@/lib/api/admin";
import { PageHeader } from "@/components/shared/Header";
import { ErrorState } from "@/components/shared/ErrorState";
import { SectionCard } from "@/components/admin/SectionCard";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { toErrorMessage } from "@/types/api";

type TabKey = "general" | "ai" | "cache" | "maintenance";

const TABS: { key: TabKey; label: string; icon: typeof SettingsIcon }[] = [
  { key: "general", label: "General", icon: SettingsIcon },
  { key: "ai", label: "AI & RAG", icon: Bot },
  { key: "cache", label: "Cache", icon: Database },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
];

/** Accessible on/off switch (native checkbox under the hood). */
function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3",
        disabled ? "opacity-60" : "cursor-pointer hover:border-slate-300"
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
            {description}
          </span>
        ) : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={cn(
            "h-6 w-11 rounded-full transition-colors",
            checked ? "bg-blue-600" : "bg-slate-300",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40"
          )}
          aria-hidden
        />
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
          aria-hidden
        />
      </span>
    </label>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      )}
    >
      {ok ? (
        <CheckCircle2 className="size-3.5" aria-hidden />
      ) : (
        <AlertCircle className="size-3.5" aria-hidden />
      )}
      {label}
    </span>
  );
}

interface FormState {
  company_name: string;
  company_email: string;
  hr_contact: string;
  timezone: string;
  ai_enabled: boolean;
  rag_enabled: boolean;
  top_k: number;
  retrieval_score_threshold: number;
  max_retries: number;
  chat_history_max_messages: number;
  redis_cache_ttl: number;
}

export function SettingsView() {
  const { data, loading, error, refetch } = useApi(getSettings, []);
  const { data: health } = useApi(getAdminHealth, []);

  const [tab, setTab] = useState<TabKey>("general");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<null | "cache" | "reindex">(null);
  const [busyAction, setBusyAction] = useState(false);

  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setForm({
        company_name: data.general.companyName ?? "",
        company_email: data.general.companyEmail ?? "",
        hr_contact: data.general.hrContact ?? "",
        timezone: data.general.timezone ?? "UTC",
        ai_enabled: data.ai.aiEnabled,
        rag_enabled: data.ai.ragEnabled,
        top_k: data.ai.topK,
        retrieval_score_threshold: data.ai.retrievalScoreThreshold,
        max_retries: data.ai.maxRetries,
        chat_history_max_messages: data.ai.chatHistoryMaxMessages,
        redis_cache_ttl: data.cache.cacheTtl,
      });
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await updateSettings({ ...form });
      if (res.rejected?.length) {
        toast.warning("Saved with rejections", {
          description: `Ignored: ${res.rejected.join(", ")}`,
        });
      } else {
        toast.success("Settings saved", {
          description: res.changed?.length
            ? `Updated ${res.changed.length} setting(s).`
            : "No changes detected.",
        });
      }
      refetch();
    } catch (err) {
      toast.error("Couldn't save settings", { description: toErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    setBusyAction(true);
    try {
      if (pending === "cache") {
        const res = await clearCache();
        toast.success("Cache cleared", {
          description:
            res.deleted > 0
              ? `${res.deleted} cached answer(s) removed.`
              : res.redisStatus === "ok"
                ? "Cache was already empty."
                : "Redis is unavailable — nothing to clear.",
        });
      } else if (pending === "reindex") {
        const res = await reindexPolicies();
        toast.success("Reindex complete", {
          description: `${res.indexed.length} file(s), ${res.totalVectors} vector(s)${
            res.failed.length ? ` · ${res.failed.length} failed` : ""
          }`,
        });
      }
      setPending(null);
      refetch();
    } catch (err) {
      toast.error("Action failed", { description: toErrorMessage(err) });
    } finally {
      setBusyAction(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeader title="System Settings" />
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="System Settings"
        description="Configure general, AI, cache, and maintenance options."
        actions={
          tab !== "maintenance" ? (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || loading || !form}
              className="h-9 bg-blue-600 text-white hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          ) : null
        }
      />

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 sm:flex-none",
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading || !form ? (
        <SectionCard>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        </SectionCard>
      ) : (
        <>
          {/* GENERAL */}
          {tab === "general" ? (
            <div
              role="tabpanel"
              id="panel-general"
              aria-labelledby="tab-general"
              className="space-y-4"
            >
              <SectionCard
                title="Organization"
                description="Branding and contact details shown across the copilot."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-company" className="text-xs font-semibold text-slate-600">
                      Company name
                    </Label>
                    <Input
                      id="s-company"
                      value={form.company_name}
                      onChange={(e) => set("company_name", e.target.value)}
                      className="h-10 border-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-email" className="text-xs font-semibold text-slate-600">
                      Company email
                    </Label>
                    <Input
                      id="s-email"
                      type="email"
                      value={form.company_email}
                      onChange={(e) => set("company_email", e.target.value)}
                      placeholder="hr@company.com"
                      className="h-10 border-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-hr" className="text-xs font-semibold text-slate-600">
                      HR contact
                    </Label>
                    <Input
                      id="s-hr"
                      value={form.hr_contact}
                      onChange={(e) => set("hr_contact", e.target.value)}
                      placeholder="Name or team"
                      className="h-10 border-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-tz" className="text-xs font-semibold text-slate-600">
                      Timezone
                    </Label>
                    <Input
                      id="s-tz"
                      value={form.timezone}
                      onChange={(e) => set("timezone", e.target.value)}
                      placeholder="UTC"
                      className="h-10 border-slate-300"
                    />
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {/* AI & RAG */}
          {tab === "ai" ? (
            <div
              role="tabpanel"
              id="panel-ai"
              aria-labelledby="tab-ai"
              className="space-y-4"
            >
              <SectionCard
                title="AI safety"
                description="Master switches for the assistant and retrieval pipeline."
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Toggle
                    label="AI responses enabled"
                    description="When off, the copilot won't call the LLM."
                    checked={form.ai_enabled}
                    onChange={(v) => set("ai_enabled", v)}
                  />
                  <Toggle
                    label="RAG retrieval enabled"
                    description="When off, answers skip the knowledge base."
                    checked={form.rag_enabled}
                    onChange={(v) => set("rag_enabled", v)}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Retrieval tuning"
                description="Numeric pipeline settings applied at request time."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <NumberField
                    id="s-topk"
                    label="Top K results"
                    value={form.top_k}
                    min={1}
                    max={20}
                    onChange={(v) => set("top_k", v)}
                    hint="Chunks retrieved per query."
                  />
                  <NumberField
                    id="s-thresh"
                    label="Score threshold"
                    value={form.retrieval_score_threshold}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => set("retrieval_score_threshold", v)}
                    hint="Minimum similarity to accept a chunk."
                  />
                  <NumberField
                    id="s-retries"
                    label="Max retries"
                    value={form.max_retries}
                    min={0}
                    max={10}
                    onChange={(v) => set("max_retries", v)}
                    hint="LLM/retrieval retry attempts."
                  />
                  <NumberField
                    id="s-history"
                    label="History messages"
                    value={form.chat_history_max_messages}
                    min={0}
                    max={50}
                    onChange={(v) => set("chat_history_max_messages", v)}
                    hint="Prior messages sent as context."
                  />
                </div>
              </SectionCard>
            </div>
          ) : null}

          {/* CACHE */}
          {tab === "cache" ? (
            <div
              role="tabpanel"
              id="panel-cache"
              aria-labelledby="tab-cache"
              className="space-y-4"
            >
              <SectionCard
                title="Response cache"
                description="Redis-backed answer cache. Cache hits are still persisted to the conversation."
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <StatusPill
                    ok={data?.cache.redisStatus === "ok"}
                    label={`Redis: ${data?.cache.redisStatus ?? "unknown"}`}
                  />
                  <StatusPill
                    ok={Boolean(data?.cache.redisEnabled)}
                    label={`Configured: ${data?.cache.redisEnabled ? "yes" : "no"}`}
                  />
                </div>
                <NumberField
                  id="s-ttl"
                  label="Cache TTL (seconds)"
                  value={form.redis_cache_ttl}
                  min={0}
                  max={86400}
                  step={60}
                  onChange={(v) => set("redis_cache_ttl", v)}
                  hint="How long a cached answer stays valid. 0 disables caching."
                />
              </SectionCard>
            </div>
          ) : null}

          {/* MAINTENANCE */}
          {tab === "maintenance" ? (
            <div
              role="tabpanel"
              id="panel-maintenance"
              aria-labelledby="tab-maintenance"
              className="space-y-4"
            >
              <SectionCard
                title="System health"
                description="Live status of the services backing the copilot."
              >
                <div className="flex flex-wrap gap-2">
                  <StatusPill ok={health?.database === "ok"} label={`Database: ${health?.database ?? "—"}`} />
                  <StatusPill ok={health?.redis === "ok"} label={`Redis: ${health?.redis ?? "—"}`} />
                  <StatusPill ok={health?.pinecone === "ok"} label={`Pinecone: ${health?.pinecone ?? "—"}`} />
                  <StatusPill ok={Boolean(health?.groqConfigured)} label={`Groq: ${health?.groqConfigured ? "configured" : "missing"}`} />
                  <StatusPill ok={Boolean(health?.cohereConfigured)} label={`Cohere: ${health?.cohereConfigured ? "configured" : "missing"}`} />
                  <StatusPill ok={Boolean(health?.cloudinaryConfigured)} label={`Cloudinary: ${health?.cloudinaryConfigured ? "configured" : "missing"}`} />
                </div>
              </SectionCard>

              <SectionCard
                title="Danger zone"
                description="These actions affect all users. They're logged to the audit trail."
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Trash2 className="size-4 text-slate-500" aria-hidden />
                      Clear answer cache
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Flushes all cached answers. Next identical questions
                      re-run the full pipeline.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPending("cache")}
                      className="mt-3 border-slate-300"
                    >
                      Clear cache
                    </Button>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <RefreshCw className="size-4 text-slate-500" aria-hidden />
                      Reindex knowledge base
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Re-ingests the seeded sample KB into Pinecone and
                      invalidates the cache.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPending("reindex")}
                      className="mt-3 border-slate-300"
                    >
                      Reindex now
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending === "cache" ? "Clear the answer cache?" : "Reindex the knowledge base?"}
        description={
          pending === "cache"
            ? "All cached answers will be removed. This is safe but may slow the next responses while the cache refills."
            : "The sample knowledge base will be re-embedded and upserted into Pinecone, and the cache invalidated. This may take a moment."
        }
        confirmLabel={pending === "cache" ? "Clear cache" : "Reindex"}
        busy={busyAction}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-slate-600">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 border-slate-300"
      />
      {hint ? <p className="text-[11px] leading-4 text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default SettingsView;
