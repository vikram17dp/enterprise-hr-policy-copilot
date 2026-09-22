"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getMyProfile,
  signIn,
  syncUser,
} from "@/lib/api/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [selectedRole, setSelectedRole] = useState<
    "employee" | "admin"
  >("employee");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const role = sessionStorage.getItem(
      "selectedRole"
    );

    if (role === "admin" || role === "employee") {
      setSelectedRole(role);
    }
  }, []);

  const handleLogin = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Email is required", {
        description:
          "Please enter your email address.",
      });
      return;
    }

    if (!password) {
      toast.error("Password is required", {
        description:
          "Please enter your password.",
      });
      return;
    }

    setLoading(true);

    const loadingToast = toast.loading(
      "Signing you in..."
    );

    try {
      await signIn(email.trim(), password);

      await syncUser();

      const profile = await getMyProfile();

      if (
        selectedRole === "admin" &&
        profile.role !== "admin"
      ) {
        toast.error(
          "Administrator access required",
          {
            id: loadingToast,
            description:
              "This account does not have administrator access.",
          }
        );

        return;
      }

      if (
        selectedRole === "employee" &&
        profile.role === "admin"
      ) {
        toast.error(
          "Wrong workspace selected",
          {
            id: loadingToast,
            description:
              "This is an administrator account. Please select Administrator.",
          }
        );

        return;
      }

      sessionStorage.removeItem(
        "selectedRole"
      );

      toast.success(
        profile.role === "admin"
          ? "Welcome back, Administrator"
          : "Welcome back",
        {
          id: loadingToast,
          description:
            "Taking you to your dashboard...",
        }
      );

      setTimeout(() => {
        if (profile.role === "admin") {
          router.replace("/admin/dashboard");
        } else {
          router.replace("/dashboard");
        }
      }, 600);

    } catch (err) {
      toast.error("Sign in failed", {
        id: loadingToast,
        description:
          err instanceof Error
            ? err.message
            : "Unable to sign in. Please check your credentials.",
      });
    } finally {
      setLoading(false);
    }
  };

  const changeRole = () => {
    toast("Change workspace", {
      description:
        "Choose Employee or Administrator.",
    });

    router.push("/role-selection");
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-[42%_58%]">

        {/* =====================================================
            LEFT SIDE
        ====================================================== */}

        <section className="relative hidden overflow-hidden bg-[#0b1220] lg:flex lg:flex-col">

          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

          <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative z-10 flex h-full flex-col px-12 py-10 xl:px-16">

            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                H
              </div>

              <span className="text-lg font-semibold tracking-tight text-white">
                HR Copilot
              </span>
            </Link>

            {/* Main */}
            <div className="my-auto max-w-lg">

              <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-blue-400">
                Enterprise HR Intelligence
              </p>

              <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white xl:text-5xl">
                Your HR policies,
                <br />
                always within
                <br />
                reach.
              </h1>

              <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
                Access accurate answers to your
                company's HR policies and
                procedures through a secure
                AI-powered assistant.
              </p>

              {/* Feature 1 */}
              <div className="mt-9 flex items-start gap-4">

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800/60">
                  <svg
                    className="h-4 w-4 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-sm font-medium text-white">
                    Trusted policy information
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Find answers based on your
                    organization's HR knowledge base.
                  </p>
                </div>

              </div>

              {/* Feature 2 */}
              <div className="mt-5 flex items-start gap-4">

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800/60">
                  <svg
                    className="h-4 w-4 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v2h8z"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-sm font-medium text-white">
                    Secure by design
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Built with enterprise security
                    and privacy in mind.
                  </p>
                </div>

              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-slate-800 pt-6">
              <span className="text-xs text-slate-600">
                © 2026 HR Copilot
              </span>
            </div>

          </div>
        </section>

        {/* =====================================================
            RIGHT SIDE
        ====================================================== */}

        <section className="flex min-h-screen items-center justify-center px-6 py-8 sm:px-10 lg:px-16">

          <div className="w-full max-w-[520px]">

            {/* Mobile logo */}
            <div className="mb-8 flex items-center lg:hidden">

              <Link
                href="/"
                className="flex items-center gap-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                  H
                </div>

                <span className="text-lg font-semibold text-slate-900">
                  HR Copilot
                </span>
              </Link>

            </div>

            {/* Header */}
            <div>

              <p className="text-sm font-medium text-blue-600">
                Welcome back
              </p>

              <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-900">
                Sign in to your account
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Access your organization's HR policy
                assistant securely.
              </p>

            </div>

            {/* Role */}
            <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">

              <div>

                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Signing in as
                </p>

                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {selectedRole === "admin"
                    ? "Administrator"
                    : "Employee"}
                </p>

              </div>

              <button
                type="button"
                onClick={changeRole}
                className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
              >
                Change
              </button>

            </div>

            {/* Form */}
            <form
              onSubmit={handleLogin}
              className="mt-5 space-y-4"
            >

              {/* Email */}
              <div>

                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                />

              </div>

              {/* Password */}
              <div>

                <div className="mb-1.5 flex items-center justify-between">

                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      toast.info(
                        "Password recovery",
                        {
                          description:
                            "Password reset will be available here.",
                        }
                      )
                    }
                    className="text-sm text-slate-400 transition hover:text-blue-600"
                  >
                    Forgot password?
                  </button>

                </div>

                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                />

              </div>

              {/* Sign in */}
              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Signing in..."
                  : "Sign in"}
              </button>

            </form>

            {/* Signup */}
            {selectedRole === "employee" && (
              <p className="mt-5 text-center text-sm text-slate-500">
                Don't have an account?{" "}

                <Link
                  href="/signup"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Create an account
                </Link>
              </p>
            )}

          </div>

        </section>

      </div>
    </main>
  );
}