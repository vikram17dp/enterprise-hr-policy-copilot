"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Role = "employee" | "admin";

export default function RoleSelectionPage() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] =
    useState<Role>("employee");

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);

    if (role === "employee") {
      toast.success("Employee selected", {
        description:
          "You'll continue as an employee.",
      });
    } else {
      toast.success("Administrator selected", {
        description:
          "You'll continue as an administrator.",
      });
    }
  };

  const handleContinue = () => {
    sessionStorage.setItem(
      "selectedRole",
      selectedRole
    );

    toast.success(
      selectedRole === "admin"
        ? "Continuing as Administrator"
        : "Continuing as Employee",
      {
        description: "Taking you to sign in...",
      }
    );

    setTimeout(() => {
      router.push("/login");
    }, 500);
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
                Choose your workspace
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Select how you'll use HR Copilot to
                continue.
              </p>

            </div>

            {/* Role cards */}
            <div className="mt-7 grid gap-4 sm:grid-cols-2">

              {/* Employee */}
              <button
                type="button"
                onClick={() =>
                  handleRoleSelect("employee")
                }
                className={`group rounded-xl border p-5 text-left transition ${
                  selectedRole === "employee"
                    ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/10"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >

                <div className="flex items-start justify-between">

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        cx="12"
                        cy="8"
                        r="3"
                        strokeWidth="2"
                      />

                      <path
                        strokeLinecap="round"
                        strokeWidth="2"
                        d="M5 21a7 7 0 0114 0"
                      />
                    </svg>
                  </div>

                  {selectedRole === "employee" && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="m5 12 4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}

                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-900">
                  Employee
                </h3>

                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                  Ask questions about HR policies,
                  leave, benefits, and company
                  procedures.
                </p>

              </button>

              {/* Admin */}
              <button
                type="button"
                onClick={() =>
                  handleRoleSelect("admin")
                }
                className={`group rounded-xl border p-5 text-left transition ${
                  selectedRole === "admin"
                    ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/10"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >

                <div className="flex items-start justify-between">

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 3l7 4v5c0 4.8-2.9 8.9-7 10-4.1-1.1-7-5.2-7-10V7l7-4z"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4"
                      />
                    </svg>
                  </div>

                  {selectedRole === "admin" && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="m5 12 4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}

                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-900">
                  Administrator
                </h3>

                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                  Manage users, HR documents, queries,
                  settings, and audit activity.
                </p>

              </button>

            </div>

            {/* Continue */}
            <button
              type="button"
              onClick={handleContinue}
              className="mt-6 h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            >
              Continue as{" "}
              {selectedRole === "employee"
                ? "Employee"
                : "Administrator"}
            </button>

            {/* Sign in */}
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