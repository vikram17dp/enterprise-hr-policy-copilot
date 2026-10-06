import {
  LayoutDashboard,
  MessageSquareText,
  History,
  Bookmark,
  FileText,
  LifeBuoy,
  User as UserIcon,
  MessagesSquare,
  Users,
  Files,
  Settings,
  ScrollText,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export const APP_NAME = "HR Copilot";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const API_V1 = "/api/v1";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional short description shown in the page header. */
  description?: string;
}

/**
 * Employee navigation. Admin lives under /admin and is intentionally
 * excluded from this list.
 */
export const EMPLOYEE_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Your HR assistant overview",
  },
  {
    label: "Ask a Question",
    href: "/ask",
    icon: MessageSquareText,
    description: "Get accurate answers based on your organization's HR policies.",
  },
  {
    label: "My Conversations",
    href: "/conversations",
    icon: History,
    description: "View and continue your previous HR policy conversations.",
  },
  {
    label: "Saved Answers",
    href: "/saved-answers",
    icon: Bookmark,
    description: "Quickly access HR policy answers you've saved.",
  },
  {
    label: "Policy Documents",
    href: "/documents",
    icon: FileText,
    description: "Browse your organization's HR policies and guidelines.",
  },
  {
    label: "Feedback",
    href: "/feedback",
    icon: LifeBuoy,
    description: "Help us improve the HR Copilot experience.",
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserIcon,
    description: "Manage your account and security settings.",
  },
];

/**
 * Admin navigation for the /admin area. Rendered by AdminSidebar.
 */
export const ADMIN_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    description: "System overview, key metrics, and recent activity.",
  },
  {
    label: "Employee Queries",
    href: "/admin/queries",
    icon: MessagesSquare,
    description: "Review, triage, and respond to employee HR queries.",
  },
  {
    label: "User Management",
    href: "/admin/users",
    icon: Users,
    description: "Manage employee accounts, roles, and access status.",
  },
  {
    label: "Policy Documents",
    href: "/admin/policies",
    icon: Files,
    description: "Upload, update, and manage the HR knowledge base.",
  },
  {
    label: "Reports & Analytics",
    href: "/admin/reports",
    icon: BarChart3,
    description: "Trends and insights across queries, users, and policies.",
  },
  {
    label: "Audit Logs",
    href: "/admin/audit-logs",
    icon: ScrollText,
    description: "A record of administrative and system actions.",
  },
  {
    label: "System Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Configure general, AI, cache, and maintenance options.",
  },
  {
    label: "Profile",
    href: "/admin/profile",
    icon: UserIcon,
    description: "Your administrator account and security settings.",
  },
];

export const QUICK_QUESTIONS: string[] = [
  "How many vacation days do I get?",
  "What is the work-from-home policy?",
  "How does maternity leave work?",
  "How do I claim reimbursement?",
  "What are the sick leave rules?",
  "How do I update my personal information?",
];

export const ASK_EXAMPLES: string[] = [
  "How many vacation days do I get?",
  "What is the work-from-home policy?",
  "Can I claim internet reimbursement?",
];

/** Query param used to prefill the Ask input from the dashboard. */
export const ASK_QUERY_PARAM = "q";

export const FEEDBACK_CATEGORIES: {
  value: string;
  label: string;
}[] = [
  { value: "answer_accuracy", label: "Answer accuracy" },
  { value: "missing_information", label: "Missing information" },
  { value: "incorrect_policy", label: "Incorrect policy" },
  { value: "user_experience", label: "User experience" },
  { value: "other", label: "Other" },
];

/* ------------------------------- admin ---------------------------------- */

/**
 * Query workflow statuses (admin_query_meta.status). The list endpoint filters
 * by exact status; the detail editor sets one of these.
 */
export const QUERY_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

/**
 * Suggested query categories. The backend filters categories with a substring
 * match and stores them as free text, so admins may also type a custom value;
 * these are offered as convenient, consistent suggestions.
 */
export const QUERY_CATEGORIES: string[] = [
  "Leave & Attendance",
  "Payroll & Salary",
  "Benefits & Insurance",
  "Work From Home",
  "Reimbursement",
  "Onboarding",
  "Performance",
  "Code of Conduct",
  "IT & Access",
  "Other",
];

/** User account statuses (users.status). */
export const USER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "inactive", label: "Inactive" },
];

/** Assignable roles (users.role). */
export const USER_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "admin", label: "Administrator" },
];

/** Policy document lifecycle statuses (documents.status). */
export const POLICY_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "archived", label: "Archived" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

/** Default page size for admin tables. */
export const ADMIN_PAGE_SIZE = 10;
