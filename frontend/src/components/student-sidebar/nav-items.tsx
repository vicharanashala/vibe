import { LayoutDashboard, Flag, BookOpen, Megaphone, FileText, SquareTerminal, type LucideIcon } from "lucide-react";

export type StudentNavItem = {
  /** Stable identifier — used for keys and conditional logic. */
  key: string;
  title: string;
  to: string;
  icon: LucideIcon;
  /** Only render when this capability is present (e.g. HP System). */
  requires?: "hpSystem";
  /** Show the "new" indicator dot when true (e.g. unseen announcements). */
  indicator?: "announcements";
};

/**
 * Single source of truth for the student primary navigation.
 * Order here is the order shown in the sidebar.
 */
export const STUDENT_NAV_ITEMS: StudentNavItem[] = [
  { key: "dashboard", title: "Dashboard", to: "/student", icon: LayoutDashboard },
  { key: "flags", title: "My Flags", to: "/student/issues", icon: Flag },
  { key: "courses", title: "Courses", to: "/student/courses", icon: BookOpen },
  { key: "hp-system", title: "HP System", to: "/student/hp-system/cohorts", icon: SquareTerminal, requires: "hpSystem" },
  { key: "announcements", title: "Announcements", to: "/student/announcements", icon: Megaphone, indicator: "announcements" },
  { key: "submissions", title: "My Submissions", to: "/student/submissions", icon: FileText },
];
