import Link from "next/link";

function ShieldIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3 5 6v5c0 4.8 2.9 8.9 7 10 4.1-1.1 7-5.2 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m12 3-1.2 4.8L6 9l4.8 1.2L12 15l1.2-4.8L18 9l-4.8-1.2L12 3Z" />
      <path d="m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L22 18l-2.3-.7L19 15Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="8" r="3" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white font-sans text-slate-900">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[650px] overflow-hidden">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[850px] -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl" />

        <div className="absolute right-[-150px] top-[150px] h-[300px] w-[300px] rounded-full bg-indigo-100/40 blur-3xl" />

        <div className="absolute left-[-150px] top-[200px] h-[280px] w-[280px] rounded-full bg-cyan-100/30 blur-3xl" />
      </div>

      {/* ================= NAVBAR ================= */}
      <header className="relative z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
              <SparkleIcon />
            </div>

            <div>
              <p className="text-[15px] font-bold leading-none tracking-tight text-slate-900">
                HR Copilot
              </p>

              <p className="mt-1 text-[11px] text-slate-500">
                Enterprise HR Policy Assistant
              </p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center gap-9 md:flex">
            <a
              href="#about"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              About
            </a>

            <a
              href="#security"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Security
            </a>

            <a
              href="#contact"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Contact
            </a>
          </nav>

          <Link
            href="/role-selection"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section
        id="about"
        className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pb-20 lg:pt-16"
      >
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          {/* LEFT CONTENT */}
          <div className="max-w-xl">
            {/* Badge */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />

              <span className="text-xs font-semibold text-blue-700">
                AI-powered enterprise HR assistant
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-[58px]">
              Your AI-Powered
              <span className="mt-1 block text-blue-600">
                HR Policy Assistant
              </span>
            </h1>

            {/* Description */}
            <p className="mt-6 max-w-[580px] text-[15px] leading-7 text-slate-600 sm:text-base">
              Get instant answers to company policies, HR processes, benefits,
              leave policies, and employee-related questions — all in one
              secure place.
            </p>

            {/* Features */}
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <ShieldIcon />
                </div>

                <span className="text-sm font-medium text-slate-700">
                  Accurate information
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <SparkleIcon />
                </div>

                <span className="text-sm font-medium text-slate-700">
                  Always up to date
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <LockIcon />
                </div>

                <span className="text-sm font-medium text-slate-700">
                  Secure & private
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UserIcon />
                </div>

                <span className="text-sm font-medium text-slate-700">
                  Built for employees
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-xl"
              >
                Get Started
                <ArrowRightIcon />
              </Link>

              <a
                href="#security"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* RIGHT ILLUSTRATION */}
          <div className="relative mx-auto w-full max-w-[610px]">
            {/* Glow */}
            <div className="absolute inset-12 rounded-full bg-blue-200/40 blur-3xl" />

            <div className="relative h-[410px] overflow-hidden rounded-[32px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 shadow-xl shadow-blue-100/50 sm:h-[450px] sm:p-8">
              {/* Decorative circles */}
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-100/70" />

              <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-indigo-100/70" />

              {/* Main card */}
              <div className="absolute left-1/2 top-1/2 w-[82%] max-w-[470px] -translate-x-1/2 -translate-y-1/2">
                <div className="rounded-3xl border border-white bg-white/95 p-5 shadow-2xl backdrop-blur sm:p-6">
                  {/* Card header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                        <SparkleIcon />
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          HR Copilot
                        </p>

                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                          <p className="text-xs font-medium text-emerald-600">
                            AI assistant online
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Question */}
                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">
                      Ask me about your HR policies
                    </p>

                    <div className="mt-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      <p className="text-sm text-slate-700">
                        How many casual leaves can I take?
                      </p>
                    </div>
                  </div>

                  {/* Answer */}
                  <div className="mt-4 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <SparkleIcon />
                    </div>

                    <p className="text-xs leading-5 text-slate-600">
                      You can take up to{" "}
                      <span className="font-bold text-slate-900">
                        12 casual leaves
                      </span>{" "}
                      per year as per the company leave policy.
                    </p>
                  </div>
                </div>

                {/* Trusted answers */}
                <div className="absolute -right-4 -top-5 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckIcon />
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-slate-900">
                        Trusted answers
                      </p>

                      <p className="text-[10px] text-slate-500">
                        Policy-grounded
                      </p>
                    </div>
                  </div>
                </div>

                {/* Security badge */}
                <div className="absolute -bottom-5 -left-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <LockIcon />
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-slate-900">
                        Secure & private
                      </p>

                      <p className="text-[10px] text-slate-500">
                        Enterprise ready
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECURITY ================= */}
      <section
        id="security"
        className="border-y border-slate-100 bg-slate-50/70"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-blue-600">
              Designed for enterprise HR
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Everything employees need
            </h2>

            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
              Quickly find reliable answers without searching through multiple
              HR documents and policy files.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <SparkleIcon />
              </div>

              <h3 className="mt-5 font-semibold text-slate-900">
                Intelligent answers
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ask natural-language questions and receive answers grounded in
                your company's HR policies.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldIcon />
              </div>

              <h3 className="mt-5 font-semibold text-slate-900">
                Policy grounded
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Answers can reference the underlying policy documents so users
                can understand where information comes from.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <LockIcon />
              </div>

              <h3 className="mt-5 font-semibold text-slate-900">
                Secure access
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Role-based access keeps employee and administrative
                functionality separated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section id="contact" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-3xl bg-blue-600 px-6 py-12 text-center shadow-xl shadow-blue-600/20 sm:px-10">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Get answers when you need them
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
            Access your HR policies through a simple, intelligent assistant
            built for your organization.
          </p>

          <Link
            href="/login"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            Get Started
            <ArrowRightIcon />
          </Link>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row sm:px-8 lg:px-10">
          <div>
            <p className="text-sm font-bold text-slate-900">HR Copilot</p>

            <p className="mt-1 text-xs text-slate-500">
              Enterprise HR Policy Assistant
            </p>
          </div>

          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} HR Copilot. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}