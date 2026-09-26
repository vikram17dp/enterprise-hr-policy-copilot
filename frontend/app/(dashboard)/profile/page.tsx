"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/Header";
import { UserAvatar } from "@/components/shared/Avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import { updatePassword, validateAvatarFile } from "@/lib/api/users";
import { formatDate } from "@/lib/utils/formatDate";
import { toErrorMessage } from "@/types/api";

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500";

/**
 * Route: /profile
 * View account details, edit the full name (email + role are read-only),
 * change password, and log out.
 */
export default function ProfilePage() {
  const { user, fullName, email, role, avatarUrl, isLoading, updateProfile, changeAvatar } =
    useUser();
  const { signOut } = useAuth();

  const roleLabel = role === "admin" ? "Administrator" : "Employee";

  // --- profile picture ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Revoke the object URL when it is replaced or on unmount (no memory leak).
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resetFileSelection = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setAvatarError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    const error = validateAvatarFile(file);
    if (error || !file) {
      setAvatarError(error ?? "Please choose an image file.");
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setAvatarError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile || uploading) return;

    const error = validateAvatarFile(selectedFile);
    if (error) {
      setAvatarError(error);
      return;
    }

    setUploading(true);
    setAvatarError(null);
    try {
      await changeAvatar(selectedFile);
      toast.success("Profile picture updated");
      resetFileSelection();
    } catch (err) {
      const message = toErrorMessage(err);
      setAvatarError(message);
      toast.error("Unable to upload picture", { description: message });
    } finally {
      setUploading(false);
    }
  };

  // --- name form ---
  const [name, setName] = useState(fullName);
  const [prevFullName, setPrevFullName] = useState(fullName);
  const [nameTouched, setNameTouched] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // Sync the draft when the loaded profile arrives/changes. This is the
  // React-recommended "adjust state during render" pattern, which avoids a
  // synchronous setState inside an effect.
  if (fullName !== prevFullName) {
    setPrevFullName(fullName);
    setName(fullName);
  }

  const nameError =
    name.trim().length < 2 ? "Name must be at least 2 characters." : null;
  const nameChanged = name.trim() !== fullName.trim();

  const handleSaveName = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNameTouched(true);
    if (nameError || !nameChanged) return;

    setSavingName(true);
    try {
      await updateProfile(name.trim());
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error("Unable to update your profile", {
        description: toErrorMessage(err),
      });
    } finally {
      setSavingName(false);
    }
  };

  // --- password form ---
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const passwordError =
    password.length > 0 && password.length < 8
      ? "Password must be at least 8 characters."
      : null;
  const confirmError =
    confirm.length > 0 && confirm !== password ? "Passwords do not match." : null;
  const canSubmitPassword =
    password.length >= 8 && confirm === password && !savingPassword;

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordTouched(true);
    if (!canSubmitPassword) {
      toast.error("Please fix the password fields", {
        description: "Ensure both passwords match and are at least 8 characters.",
      });
      return;
    }

    setSavingPassword(true);
    try {
      await updatePassword(password);
      toast.success("Password changed successfully");
      setPassword("");
      setConfirm("");
      setPasswordTouched(false);
    } catch (err) {
      toast.error("Unable to change password", {
        description: toErrorMessage(err),
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Manage your account and security settings." />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Identity card */}
        <section className="h-fit rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          {isLoading ? (
            <>
              <Skeleton className="mx-auto size-20 rounded-full" />
              <Skeleton className="mx-auto mt-4 h-4 w-32" />
              <Skeleton className="mx-auto mt-2 h-3 w-40" />
            </>
          ) : (
            <>
              <UserAvatar
                name={fullName}
                email={email}
                src={previewUrl ?? avatarUrl}
                size="lg"
                className="mx-auto size-20 text-lg"
              />

              {/* Change photo: file picker -> preview -> confirm upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="mt-3 flex items-center justify-center gap-2">
                {previewUrl ? (
                  <>
                    <Button
                      type="button"
                      disabled={uploading}
                      onClick={() => void handleUploadAvatar()}
                      className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : "Upload photo"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={uploading}
                      onClick={resetFileSelection}
                      className="h-9 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLoading || uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 gap-1.5 rounded-lg border-slate-300 px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Camera className="size-4" aria-hidden />
                    Change Photo
                  </Button>
                )}
              </div>

              {avatarError ? (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {avatarError}
                </p>
              ) : null}

              <h2 className="mt-4 text-base font-semibold text-slate-900">
                {fullName || "Employee"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">{email}</p>

              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <ShieldCheck className="size-3.5" aria-hidden />
                {roleLabel}
              </span>

              <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Mail className="size-3.5 text-slate-400" aria-hidden />
                    Email
                  </dt>
                  <dd className="truncate text-xs text-slate-700">{email}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <UserRound className="size-3.5 text-slate-400" aria-hidden />
                    Account created
                  </dt>
                  <dd className="text-xs text-slate-700">
                    {user?.created_at ? formatDate(user.created_at) : "—"}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </section>

        {/* Forms */}
        <div className="space-y-6">
          {/* Personal information */}
          <form
            onSubmit={handleSaveName}
            noValidate
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <h2 className="text-sm font-semibold text-slate-900">
              Personal information
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your email and role are managed by your organization and are
              read-only.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="full-name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Full name
                </label>
                <input
                  id="full-name"
                  type="text"
                  value={name}
                  disabled={isLoading || savingName}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameTouched(true);
                  }}
                  placeholder="Your full name"
                  className={inputClass}
                  aria-invalid={nameTouched && !!nameError}
                />
                {nameTouched && nameError ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {nameError}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="email-readonly"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>
                <input
                  id="email-readonly"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className={inputClass}
                />
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Role
                </span>
                <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button
                type="submit"
                disabled={savingName || !nameChanged || !!nameError}
                className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingName ? "Saving..." : "Save changes"}
              </Button>
              {nameChanged && !nameError ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setName(fullName);
                    setNameTouched(false);
                  }}
                  className="h-10 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100"
                >
                  Reset
                </Button>
              ) : null}
            </div>
          </form>

          {/* Security */}
          <form
            onSubmit={handleChangePassword}
            noValidate
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-slate-400" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-900">Security</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Change your password. This updates your Supabase authentication.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  disabled={savingPassword}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordTouched(true);
                  }}
                  placeholder="At least 8 characters"
                  className={inputClass}
                  aria-invalid={passwordTouched && !!passwordError}
                />
                {passwordTouched && passwordError ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {passwordError}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  disabled={savingPassword}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setPasswordTouched(true);
                  }}
                  placeholder="Re-enter password"
                  className={inputClass}
                  aria-invalid={passwordTouched && !!confirmError}
                />
                {passwordTouched && confirmError ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {confirmError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={!canSubmitPassword}
                className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingPassword ? "Updating..." : "Change password"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => void signOut()}
                className="h-10 gap-1.5 rounded-lg border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="size-4" aria-hidden />
                Log out
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
