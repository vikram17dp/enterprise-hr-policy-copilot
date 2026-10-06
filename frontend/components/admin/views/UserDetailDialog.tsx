"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, MessageSquareText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/Avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ErrorState } from "@/components/shared/ErrorState";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useApi } from "@/hooks/useApi";
import { useUser } from "@/hooks/useUser";
import { getUser, updateUser } from "@/lib/api/admin";
import {
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from "@/lib/utils/constants";
import { formatDate, formatRelativeTime } from "@/lib/utils/formatDate";
import { toErrorMessage } from "@/types/api";
import type { UserRole } from "@/types/user";
import type { UserStatus } from "@/types/admin";

interface UserDetailDialogProps {
  userId: string;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

/**
 * User detail + edit: profile summary, usage stats, recent conversation
 * history, and controls to edit name/department, change role, and
 * activate/suspend the account. Self-demotion and self-suspension are blocked
 * in the UI (the backend independently rejects them).
 */
export function UserDetailDialog({
  userId,
  onOpenChange,
  onUpdated,
}: UserDetailDialogProps) {
  const { data, loading, error, refetch } = useApi(() => getUser(userId), [userId]);
  const { user: currentUser } = useUser();
  const isSelf = currentUser?.id === userId;

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [status, setStatus] = useState<UserStatus>("active");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | "suspend" | "activate">(null);

  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setFullName(data.full_name ?? "");
      setDepartment(data.department ?? "");
      setRole(data.role);
      setStatus(data.status);
    }
  }

  async function save(patch: {
    full_name?: string;
    department?: string;
    role?: UserRole;
    status?: UserStatus;
  }) {
    setSaving(true);
    try {
      await updateUser(userId, patch);
      toast.success("User updated");
      setConfirm(null);
      onUpdated();
      refetch();
    } catch (err) {
      toast.error("Couldn't update user", { description: toErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  function handleConfirm() {
    if (confirm === "suspend") {
      void save({ status: "suspended" });
      setStatus("suspended");
    } else if (confirm === "activate") {
      void save({ status: "active" });
      setStatus("active");
    }
  }

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="pr-8 text-base">User details</DialogTitle>
            <DialogDescription>
              Manage this account&apos;s profile, role, and access status.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {error ? (
              <ErrorState message={error} onRetry={refetch} className="m-5" />
            ) : loading || !data ? (
              <div className="space-y-4 p-5">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <div className="space-y-5 p-5">
                {/* Identity */}
                <div className="flex items-start gap-4">
                  <UserAvatar
                    name={data.full_name}
                    email={data.email}
                    src={data.avatar_url}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {data.full_name || data.email}
                    </p>
                    <p className="truncate text-sm text-slate-500">{data.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={
                          data.role === "admin"
                            ? "rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                            : "rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        }
                      >
                        {data.role === "admin" ? "Administrator" : "Employee"}
                      </span>
                      <StatusBadge status={data.status} />
                      {isSelf ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          This is you
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Conversations", value: data.stats?.conversations ?? 0 },
                    { label: "Messages", value: data.stats?.messages ?? 0 },
                    { label: "Saved answers", value: data.stats?.savedAnswers ?? 0 },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"
                    >
                      <p className="text-xl font-semibold text-slate-900 tabular-nums">
                        {s.value}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Edit form */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="u-name" className="text-xs font-semibold text-slate-600">
                      Full name
                    </Label>
                    <Input
                      id="u-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-10 border-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="u-dept" className="text-xs font-semibold text-slate-600">
                      Department
                    </Label>
                    <Input
                      id="u-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="h-10 border-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="u-role" className="text-xs font-semibold text-slate-600">
                      Role
                    </Label>
                    <FilterSelect
                      id="u-role"
                      value={role}
                      onChange={(v) => setRole(v as UserRole)}
                      options={USER_ROLE_OPTIONS}
                      className="w-full"
                      aria-label="Role"
                    />
                    {isSelf ? (
                      <p className="text-[11px] text-slate-400">
                        You can&apos;t change your own role.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="u-status" className="text-xs font-semibold text-slate-600">
                      Status
                    </Label>
                    <FilterSelect
                      id="u-status"
                      value={status}
                      onChange={(v) => setStatus(v as UserStatus)}
                      options={USER_STATUS_OPTIONS}
                      className="w-full"
                      aria-label="Status"
                    />
                    {isSelf ? (
                      <p className="text-[11px] text-slate-400">
                        You can&apos;t suspend or deactivate yourself.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() =>
                      save({
                        full_name: fullName.trim(),
                        department: department.trim(),
                        role: isSelf ? undefined : role,
                        status: isSelf ? undefined : status,
                      })
                    }
                    disabled={saving}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </Button>

                  {!isSelf ? (
                    status === "suspended" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConfirm("activate")}
                        className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="size-4" aria-hidden />
                        Activate account
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConfirm("suspend")}
                        className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Ban className="size-4" aria-hidden />
                        Suspend account
                      </Button>
                    )
                  ) : null}
                </div>

                <Separator />

                {/* Account meta + conversation history */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Account
                    </h3>
                    <dl className="space-y-1.5">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Joined</dt>
                        <dd className="font-medium text-slate-800">
                          {formatDate(data.created_at)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Last active</dt>
                        <dd className="font-medium text-slate-800">
                          {data.lastActive ? formatRelativeTime(data.lastActive) : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">User ID</dt>
                        <dd className="truncate font-mono text-xs text-slate-500">
                          {data.id}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Recent conversations
                    </h3>
                    {(data.recentConversations ?? []).length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-400">
                        No conversations yet.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {(data.recentConversations ?? []).map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2"
                          >
                            <MessageSquareText
                              className="size-4 shrink-0 text-slate-400"
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                              {c.title || "Untitled conversation"}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {formatRelativeTime(c.updatedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm === "suspend" ? "Suspend this account?" : "Activate this account?"}
        description={
          confirm === "suspend"
            ? "The user will be signed out of active sessions and blocked from accessing the copilot until reactivated."
            : "The user will regain full access to the copilot."
        }
        confirmLabel={confirm === "suspend" ? "Suspend" : "Activate"}
        destructive={confirm === "suspend"}
        busy={saving}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export default UserDetailDialog;
