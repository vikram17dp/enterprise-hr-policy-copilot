"use client";

import { useMemo, useState } from "react";
import { Users as UsersIcon, UserPlus, ChevronRight, ExternalLink } from "lucide-react";

import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { listUsers } from "@/lib/api/admin";
import { PageHeader } from "@/components/shared/Header";
import { SearchBar } from "@/components/shared/SearchBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/Avatar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserDetailDialog } from "@/components/admin/views/UserDetailDialog";
import {
  ADMIN_PAGE_SIZE,
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from "@/lib/utils/constants";
import { formatDate, formatRelativeTime } from "@/lib/utils/formatDate";
import type { AdminUser, UserStatus } from "@/types/admin";
import type { UserRole } from "@/types/user";

/** Derive the Supabase project ref from the public URL (safe, non-secret). */
function supabaseInviteUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const ref = url.replace(/^https?:\/\//, "").split(".")[0];
  if (!ref) return null;
  return `https://supabase.com/dashboard/project/${ref}/auth/add-user`;
}

export function UsersView() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 350);
  const inviteUrl = useMemo(() => supabaseInviteUrl(), []);

  const { data, loading, error, refetch } = useApi(
    () =>
      listUsers({
        search: debouncedSearch,
        role,
        status,
        page,
        page_size: ADMIN_PAGE_SIZE,
      }),
    [debouncedSearch, role, status, page]
  );

  const columns: Column<AdminUser>[] = [
    {
      key: "user",
      header: "User",
      className: "max-w-[260px]",
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <UserAvatar
            name={row.full_name}
            email={row.email}
            src={row.avatar_url}
            size="sm"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-800">
              {row.full_name || row.email}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {row.email}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (row) =>
        row.role === "admin" ? (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            Admin
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
            Employee
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "department",
      header: "Department",
      cell: (row) =>
        row.department ? (
          <span className="text-slate-700">{row.department}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "conversations",
      header: "Chats",
      align: "center",
      cell: (row) => (
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          {row.conversationCount ?? 0}
        </span>
      ),
    },
    {
      key: "lastActive",
      header: "Last active",
      cell: (row) => (
        <span className="text-xs text-slate-500">
          {row.lastActive ? formatRelativeTime(row.lastActive) : "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      cell: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: () => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
          View
          <ChevronRight className="size-4" aria-hidden />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Management"
        description="Manage employee accounts, roles, and access status."
        actions={
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="size-4" aria-hidden />
            Add user
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name or email..."
          aria-label="Search users"
          className="sm:w-80"
        />
        <FilterSelect
          value={role}
          onChange={(v) => {
            setRole(v as UserRole | "");
            setPage(1);
          }}
          options={USER_ROLE_OPTIONS}
          placeholder="All roles"
          aria-label="Filter by role"
          className="sm:w-44"
        />
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v as UserStatus | "");
            setPage(1);
          }}
          options={USER_STATUS_OPTIONS}
          placeholder="All statuses"
          aria-label="Filter by status"
          className="sm:w-44"
        />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={refetch}
        onRowClick={(row) => setSelectedId(row.id)}
        page={page}
        pageSize={ADMIN_PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyIcon={UsersIcon}
        emptyTitle="No users found"
        emptyDescription="Try adjusting your search or filters."
        skeletonRows={ADMIN_PAGE_SIZE}
      />

      {selectedId ? (
        <UserDetailDialog
          userId={selectedId}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          onUpdated={refetch}
        />
      ) : null}

      {/* Add user — provisioning happens through Supabase Auth. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>
              Accounts are provisioned through Supabase Authentication — the same
              system employees already sign in with. This app intentionally holds
              only a publishable key, so it can&apos;t create users directly (that
              would require the secret service-role key, which must never reach
              the frontend).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">How to add someone:</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Open the Supabase Dashboard → Authentication → Users →{" "}
                <span className="font-medium">Add user</span>.
              </li>
              <li>Invite them by email (or create a login directly).</li>
              <li>
                On their first sign-in, the backend syncs a{" "}
                <code className="rounded bg-slate-100 px-1">users</code> row
                automatically. New accounts default to the{" "}
                <span className="font-medium">Employee</span> role; promote to
                Admin from their detail panel here.
              </li>
            </ol>
            <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              Tip: to auto-provision an administrator, set their email as{" "}
              <code className="rounded bg-slate-100 px-1">ADMIN_EMAIL</code> in
              the backend environment — they&apos;re promoted to Admin on first sync.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Close
            </Button>
            {inviteUrl ? (
              <Button
                className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                render={<a href={inviteUrl} target="_blank" rel="noreferrer" />}
                nativeButton={false}
              >
                Open Supabase
                <ExternalLink className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UsersView;
