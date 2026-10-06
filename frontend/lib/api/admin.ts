import { apiFetch, apiUpload } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
import type {
  AdminHealth,
  AdminPolicy,
  AdminQueryDetail,
  AdminQueryRow,
  AdminSettings,
  AdminUser,
  AuditLogRow,
  DashboardData,
  Page,
  QueryStatus,
  ReportsData,
  UserStatus,
} from "@/types/admin";
import type { UserRole } from "@/types/user";

const A = `${API_V1}/admin`;

/** Build a query string from a params object, dropping empty values. */
function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/* -------------------------------- dashboard ------------------------------ */
export function getAdminDashboard(): Promise<DashboardData> {
  return apiFetch(`${A}/dashboard`, { method: "GET" }) as Promise<DashboardData>;
}

/* --------------------------------- queries ------------------------------- */
export interface QueryListParams {
  search?: string;
  status?: QueryStatus | "";
  category?: string;
  page?: number;
  page_size?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export function listQueries(
  params: QueryListParams = {}
): Promise<Page<AdminQueryRow>> {
  return apiFetch(`${A}/queries${qs(params)}`, {
    method: "GET",
  }) as Promise<Page<AdminQueryRow>>;
}

export function getQuery(id: string): Promise<AdminQueryDetail> {
  return apiFetch(`${A}/queries/${id}`, { method: "GET" }) as Promise<AdminQueryDetail>;
}

export function updateQuery(
  id: string,
  body: { status?: QueryStatus; category?: string; admin_note?: string }
): Promise<{ id: string; status: QueryStatus; category: string | null }> {
  return apiFetch(`${A}/queries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Promise<{ id: string; status: QueryStatus; category: string | null }>;
}

export function respondToQuery(
  id: string,
  message: string
): Promise<{ id: string }> {
  return apiFetch(`${A}/queries/${id}/response`, {
    method: "POST",
    body: JSON.stringify({ message }),
  }) as Promise<{ id: string }>;
}

/* ---------------------------------- users -------------------------------- */
export interface UserListParams {
  search?: string;
  role?: UserRole | "";
  status?: UserStatus | "";
  page?: number;
  page_size?: number;
}

export function listUsers(
  params: UserListParams = {}
): Promise<Page<AdminUser>> {
  return apiFetch(`${A}/users${qs(params)}`, {
    method: "GET",
  }) as Promise<Page<AdminUser>>;
}

export function getUser(id: string): Promise<AdminUser> {
  return apiFetch(`${A}/users/${id}`, { method: "GET" }) as Promise<AdminUser>;
}

export function updateUser(
  id: string,
  body: {
    full_name?: string;
    role?: UserRole;
    status?: UserStatus;
    department?: string;
  }
): Promise<AdminUser> {
  return apiFetch(`${A}/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Promise<AdminUser>;
}

export function listUserConversations(
  id: string,
  params: { page?: number; page_size?: number } = {}
): Promise<
  Page<{
    id: string;
    title: string | null;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
  }>
> {
  return apiFetch(`${A}/users/${id}/conversations${qs(params)}`, {
    method: "GET",
  }) as Promise<
    Page<{
      id: string;
      title: string | null;
      messageCount: number;
      createdAt: string;
      updatedAt: string;
    }>
  >;
}

/* --------------------------------- policies ------------------------------ */
export interface PolicyListParams {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export function listPolicies(
  params: PolicyListParams = {}
): Promise<Page<AdminPolicy>> {
  return apiFetch(`${A}/policies${qs(params)}`, {
    method: "GET",
  }) as Promise<Page<AdminPolicy>>;
}

export function getPolicy(id: string): Promise<AdminPolicy> {
  return apiFetch(`${A}/policies/${id}`, { method: "GET" }) as Promise<AdminPolicy>;
}

export function uploadPolicy(input: {
  file: File;
  title: string;
  category?: string;
  description?: string;
}): Promise<{ document: AdminPolicy; warnings: string[] }> {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("title", input.title);
  fd.append("category", input.category ?? "");
  fd.append("description", input.description ?? "");
  return apiUpload(`${A}/policies`, fd) as Promise<{
    document: AdminPolicy;
    warnings: string[];
  }>;
}

export function updatePolicy(
  id: string,
  body: {
    title?: string;
    category?: string;
    description?: string;
    status?: string;
  }
): Promise<AdminPolicy> {
  return apiFetch(`${A}/policies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Promise<AdminPolicy>;
}

export function replacePolicy(id: string, file: File): Promise<AdminPolicy> {
  const fd = new FormData();
  fd.append("file", file);
  return apiUpload(`${A}/policies/${id}/replace`, fd) as Promise<AdminPolicy>;
}

export function deletePolicy(
  id: string
): Promise<{ deleted: boolean; vectorsDeleted: boolean }> {
  return apiFetch(`${A}/policies/${id}`, {
    method: "DELETE",
  }) as Promise<{ deleted: boolean; vectorsDeleted: boolean }>;
}

/* ------------------------------- audit logs ------------------------------ */
export function listAuditLogs(
  params: { search?: string; action?: string; page?: number; page_size?: number } = {}
): Promise<Page<AuditLogRow>> {
  return apiFetch(`${A}/audit-logs${qs(params)}`, {
    method: "GET",
  }) as Promise<Page<AuditLogRow>>;
}

/* --------------------------------- reports ------------------------------- */
export function getReports(days = 30): Promise<ReportsData> {
  return apiFetch(`${A}/reports${qs({ days })}`, {
    method: "GET",
  }) as Promise<ReportsData>;
}

/* -------------------------------- settings ------------------------------- */
export function getSettings(): Promise<AdminSettings> {
  return apiFetch(`${A}/settings`, { method: "GET" }) as Promise<AdminSettings>;
}

export function updateSettings(
  settings: Record<string, unknown>
): Promise<{ changed: string[]; rejected: string[] }> {
  return apiFetch(`${A}/settings`, {
    method: "PATCH",
    body: JSON.stringify({ settings }),
  }) as Promise<{ changed: string[]; rejected: string[] }>;
}

/* ------------------------------ maintenance ------------------------------ */
export function clearCache(): Promise<{
  cleared: boolean;
  deleted: number;
  redisStatus: string;
}> {
  return apiFetch(`${A}/maintenance/clear-cache`, {
    method: "POST",
  }) as Promise<{ cleared: boolean; deleted: number; redisStatus: string }>;
}

export function reindexPolicies(): Promise<{
  indexed: { file: string; vectors: number }[];
  failed: string[];
  totalVectors: number;
}> {
  return apiFetch(`${A}/maintenance/reindex`, {
    method: "POST",
  }) as Promise<{
    indexed: { file: string; vectors: number }[];
    failed: string[];
    totalVectors: number;
  }>;
}

export function getAdminHealth(): Promise<AdminHealth> {
  return apiFetch(`${A}/health`, { method: "GET" }) as Promise<AdminHealth>;
}

export function getAdminMe(): Promise<AdminUser> {
  return apiFetch(`${A}/me`, { method: "GET" }) as Promise<AdminUser>;
}
