import {
  LayoutDashboard,
  MessageSquareText,
  History,
  Bookmark,
  FileText,
  LifeBuoy,
  User as UserIcon,
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
