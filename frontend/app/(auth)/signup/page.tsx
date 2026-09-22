"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();

  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);

  const handleSignup = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Full name is required", {
        description:
          "Please enter your full name.",
      });
      return;
    }

    if (!email.trim()) {
      toast.error("Email is required", {
        description:
          "Please enter your work email.",
      });
      return;
    }

    if (password.length < 6) {
      toast.error("Password is too short", {
        description:
          "Your password must contain at least 6 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match", {
        description:
          "Please make sure both passwords are the same.",
      });
      return;
    }

    setLoading(true);

    const loadingToast = toast.loading(
      "Creating your account..."
    );

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

      if (error) {
        toast.error("Unable to create account", {
          id: loadingToast,
          description: error.message,
        });

        return;
      }

      /*
       * Supabase may require email confirmation.
       * In that case user is created but there
       * isn't an active session yet.
       */
      if (data.user && !data.session) {
        toast.success(
          "Account created successfully",
          {
            id: loadingToast,
            description:
              "Please check your email and verify your account.",
          }
        );

        return;
      }

      toast.success(
        "Account created successfully",
        {
          id: loadingToast,
          description:
            "Taking you to the sign in page...",
        }
      );

      setTimeout(() => {
        router.push("/login");
      }, 700);

    } catch (err) {
      console.error(err);

      toast.error("Something went wrong", {
        id: loadingToast,
        description:
          "Unable to create your account. Please try again.",
      });
    } finally {
      setLoading(false);
    }
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
                HR policies,
                <br />
                made simple.
              </h1>

              <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
                Get accurate answers to your
                organization's HR policies through a
                secure AI-powered assistant.
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
                    Built with enterprise security and
                    privacy in mind.
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
                Get started
              </p>

              <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-900">
                Create your account
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Create your account to access your
                organization's HR policy assistant.
              </p>

            </div>

            {/* Form */}
            <form
              onSubmit={handleSignup}
              className="mt-7 space-y-4"
            >

              {/* Full name */}
              <div>

                <label
                  htmlFor="fullName"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Full name
                </label>

                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                />

              </div>

              {/* Email */}
              <div>

                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Work email
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

                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  Use at least 6 characters.
                </p>

              </div>

              {/* Confirm password */}
              <div>

                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                />

              </div>

              {/* Create account */}
              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Creating account..."
                  : "Create account"}
              </button>

            </form>

            {/* Login */}
            <p className="mt-5 text-center text-sm text-slate-500">
              Already have an account?{" "}

              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Sign in
              </Link>
            </p>

          </div>

        </section>

      </div>
    </main>
  );
}