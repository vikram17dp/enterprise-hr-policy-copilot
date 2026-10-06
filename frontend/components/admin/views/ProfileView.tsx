"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, KeyRound, ShieldCheck, Lock } from "lucide-react";

import { useApi } from "@/hooks/useApi";
import { useUser } from "@/hooks/useUser";
import { getAdminMe } from "@/lib/api/admin";
import { updatePassword, validateAvatarFile } from "@/lib/api/users";
import { PageHeader } from "@/components/shared/Header";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils/formatDate";
import { toErrorMessage } from "@/types/api";

/**
 * The signed-in administrator's own profile and security settings. Reuses the
 * existing self-service endpoints (PUT /users/me, the avatar upload, and
 * Supabase password update) — no admin-specific write path is needed for one's
 * own account, and role/status changes for self are intentionally not offered.
 */
export function ProfileView() {
  const { user, fullName, email, avatarUrl, updateProfile, changeAvatar } = useUser();
  const { data: me, loading } = useApi(getAdminMe, []);

  const [name, setName] = useState(fullName);
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [prevFullName, setPrevFullName] = useState(fullName);
  if (fullName !== prevFullName) {
    setPrevFullName(fullName);
    setName(fullName);
  }

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name can't be empty");
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(trimmed);
      toast.success("Profile updated");
    } catch (err) {
      toast.error("Couldn't update profile", { description: toErrorMessage(err) });
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword() {
    if (password.length < 8) {
      toast.error("Password too short", {
        description: "Use at least 8 characters.",
      });
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setSavingPw(true);
    try {
      await updatePassword(password);
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
    } catch (err) {
      toast.error("Couldn't update password", { description: toErrorMessage(err) });
    } finally {
      setSavingPw(false);
    }
  }

  async function handleAvatar(file: File | undefined | null) {
    if (!file) return;
    const invalid = validateAvatarFile(file);
    if (invalid) {
      toast.error(invalid);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      await changeAvatar(file);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error("Couldn't upload photo", { description: toErrorMessage(err) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profile"
        description="Your administrator account and security settings."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identity */}
        <SectionCard title="Identity" className="lg:col-span-2">
          {loading && !user ? (
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <UserAvatar name={fullName} email={email} src={avatarUrl} size="lg" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    aria-label="Change profile photo"
                    className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                  >
                    <Camera className="size-3.5" aria-hidden />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => handleAvatar(e.target.files?.[0])}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {fullName || "Administrator"}
                  </p>
                  <p className="truncate text-sm text-slate-500">{email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      <ShieldCheck className="size-3" aria-hidden />
                      Administrator
                    </span>
                    {me?.status ? <StatusBadge status={me.status} /> : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="prof-name" className="text-xs font-semibold text-slate-600">
                    Full name
                  </Label>
                  <Input
                    id="prof-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 border-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-email" className="text-xs font-semibold text-slate-600">
                    Email
                  </Label>
                  <Input
                    id="prof-email"
                    value={email}
                    disabled
                    className="h-10 border-slate-200 bg-slate-50 text-slate-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    Managed by Supabase Authentication.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleSaveName}
                  disabled={savingName || name.trim() === fullName}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {savingName ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Account facts */}
        <SectionCard title="Account">
          {loading && !me ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium text-slate-800">Administrator</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium capitalize text-slate-800">
                  {me?.status ?? "active"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Department</dt>
                <dd className="font-medium text-slate-800">
                  {me?.department || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Member since</dt>
                <dd className="font-medium text-slate-800">
                  {me?.created_at ? formatDate(me.created_at) : "—"}
                </dd>
              </div>
            </dl>
          )}
        </SectionCard>
      </div>

      {/* Security */}
      <SectionCard
        title="Security"
        description="Update your password. Authentication is handled by Supabase."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prof-pw" className="text-xs font-semibold text-slate-600">
              New password
            </Label>
            <Input
              id="prof-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="h-10 border-slate-300"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-pw2" className="text-xs font-semibold text-slate-600">
              Confirm password
            </Label>
            <Input
              id="prof-pw2"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              className="h-10 border-slate-300"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleChangePassword}
            disabled={savingPw || !password || !confirm}
            className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
          >
            <KeyRound className="size-4" aria-hidden />
            {savingPw ? "Updating..." : "Update password"}
          </Button>
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="size-3.5" aria-hidden />
            Secrets and service keys are never exposed here.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

export default ProfileView;
