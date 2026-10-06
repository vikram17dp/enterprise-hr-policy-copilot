/**
 * Admin Dashboard types — mirror the /api/v1/admin/* response shapes in
 * backend/app/api/v1/endpoints/admin.py.
 */

import type { UserRole } from "./user";

export type QueryStatus = "open" | "in_progress" | "resolved" | "closed";
export type UserStatus = "active" | "suspended" | "inactive";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminEmployeeRef {
  id: string;
  name: string;
  email: string;
  department?: string | null;
}

export interface AdminQueryRow {
  id: string;
  query: string | null;
  employee: AdminEmployeeRef;
  status: QueryStatus;
  category: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  source: string | null;
  createdAt: string;
}

export interface AdminQueryDetail {
  id: string;
  title: string | null;
  status: QueryStatus;
  category: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  employee: AdminUser;
  messages: AdminMessage[];
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
  department: string | null;
  avatar_url?: string | null;
  created_at: string;
  /** present on list/detail responses */
  conversationCount?: number;
  lastActive?: string | null;
  stats?: { conversations: number; messages: number; savedAnswers: number };
  recentConversations?: {
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
}

export interface AdminPolicy {
  id: string;
  title: string;
  filename: string;
  description: string | null;
  category: string | null;
  version: number;
  status: string;
  cloudinary_url: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AuditLogRow {
  id: string;
  action: string;
  actor: { id: string; email: string } | null;
  resourceType: string | null;
  resourceId: string | null;
  details: string | null;
  createdAt: string;
}

export interface DashboardData {
  metrics: {
    totalUsers: number;
    totalEmployees: number;
    activeEmployees: number;
    totalAdmins: number;
    suspendedUsers: number;
    totalQueries: number;
    totalConversations: number;
    queriesToday: number;
    queriesThisWeek: number;
    queriesThisMonth: number;
    openQueries: number;
    inProgressQueries: number;
    resolvedQueries: number;
    closedQueries: number;
    totalDocuments: number;
    activeDocuments: number;
  };
  queriesOverTime: { date: string; count: number }[];
  queriesByStatus: { status: QueryStatus; count: number }[];
  topCategories: { category: string; count: number }[];
  recentQueries: {
    id: string;
    query: string | null;
    employee: AdminEmployeeRef;
    status: QueryStatus;
    category: string | null;
    updated_at: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    actor: string;
    resource_type: string | null;
    resource_id: string | null;
    created_at: string;
  }[];
}

export interface ReportsData {
  rangeDays: number;
  queriesOverTime: { date: string; count: number }[];
  queriesByStatus: { status: QueryStatus; count: number }[];
  queriesByCategory: { category: string; count: number }[];
  queriesByDepartment: { department: string; count: number }[];
  mostActiveUsers: { email: string; queries: number }[];
  activeUsers: number;
  newUsers: number;
  documents: {
    total: number;
    byStatus: { status: string; count: number }[];
    byCategory: { category: string; count: number }[];
  };
  feedbackByRating: { rating: string; count: number }[];
  cache: { redisEnabled: boolean; redisStatus: string; cacheTtl: number };
}

export interface AdminSettings {
  general: {
    companyName: string;
    companyEmail: string;
    hrContact: string;
    timezone: string;
  };
  ai: {
    aiEnabled: boolean;
    ragEnabled: boolean;
    topK: number;
    retrievalScoreThreshold: number;
    maxRetries: number;
    chatHistoryMaxMessages: number;
  };
  cache: { redisEnabled: boolean; redisStatus: string; cacheTtl: number };
  editableKeys: string[];
}

export interface AdminHealth {
  database: string;
  redis: string;
  pinecone: string;
  groqConfigured: boolean;
  cohereConfigured: boolean;
  cloudinaryConfigured: boolean;
}
