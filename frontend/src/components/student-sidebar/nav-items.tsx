<<<<<<< HEAD
import { LayoutDashboard, Flag, BookOpen, Megaphone, FileText, SquareTerminal, MessagesSquare, type LucideIcon } from "lucide-react";
=======
import { LayoutDashboard, Flag, BookOpen, Megaphone, FileText, SquareTerminal, BarChart3, type LucideIcon } from "lucide-react";
>>>>>>> 75d7f3b8f211e06eff0e05ad3f727d3d4cb8759e

export type StudentNavItem = {
    /** Stable identifier — used for keys and conditional logic. */
    key: string;
    title: string;
    to: string;
    icon: LucideIcon;
    /** Only render when this capability is present (e.g. HP System). */
    requires?: "hpSystem" | "currentCourse";
    /** Show the "new" indicator dot when true (e.g. unseen announcements). */
    indicator?: "announcements";
};

/**
 * Single source of truth for the student primary navigation.
 * Order here is the order shown in the sidebar.
 *
 * NOTE: The `analytics` entry that exists on the Vibe-forum branch has
 * been deliberately omitted here — its target `/student/analytics` is
 * introduced by an unrelated commit that is not part of Milestone B.
 */
export const STUDENT_NAV_ITEMS: StudentNavItem[] = [
<<<<<<< HEAD
    { key: "dashboard", title: "Dashboard", to: "/student", icon: LayoutDashboard },
    { key: "flags", title: "My Flags", to: "/student/issues", icon: Flag },
    { key: "courses", title: "Courses", to: "/student/courses", icon: BookOpen },
    { key: "hp-system", title: "HP System", to: "/student/hp-system/cohorts", icon: SquareTerminal, requires: "hpSystem" },
    // Discussion entry — only visible when a course is in context. The
    // StudentSidebar resolves the dynamic courseId-derived URL at render time
    // (see the discussion handling in `StudentSidebar.tsx`).
    { key: "discussion", title: "Discussion", to: "/student/courses/", icon: MessagesSquare, requires: "currentCourse" },
    { key: "announcements", title: "Announcements", to: "/student/announcements", icon: Megaphone, indicator: "announcements" },
    { key: "submissions", title: "My Submissions", to: "/student/submissions", icon: FileText },
];
=======
  { key: "dashboard", title: "Dashboard", to: "/student", icon: LayoutDashboard },
  { key: "flags", title: "My Flags", to: "/student/issues", icon: Flag },
  { key: "courses", title: "Courses", to: "/student/courses", icon: BookOpen },
  { key: "analytics", title: "Analytics", to: "/student/analytics", icon: BarChart3 },
  { key: "hp-system", title: "HP System", to: "/student/hp-system/cohorts", icon: SquareTerminal, requires: "hpSystem" },
  { key: "announcements", title: "Announcements", to: "/student/announcements", icon: Megaphone, indicator: "announcements" },
  { key: "submissions", title: "My Submissions", to: "/student/submissions", icon: FileText },
];
>>>>>>> 75d7f3b8f211e06eff0e05ad3f727d3d4cb8759e
