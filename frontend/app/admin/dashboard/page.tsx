/**
 * Route: /admin/dashboard
 * NOTE: The admin experience is intentionally out of scope for the employee
 * task. This is a minimal placeholder so the route compiles with a valid
 * default export. It will be replaced by the real admin dashboard later.
 */
export default function AdminDashboardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Administrator workspace
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          The admin experience is out of scope for this task and will be
          implemented separately.
        </p>
      </div>
    </main>
  );
}
