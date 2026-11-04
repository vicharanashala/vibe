"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  X,
  Loader2,
  ShieldAlert,
  AlertCircle,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCourseStore } from "@/store/course-store";
import { useAuthStore } from "@/store/auth-store";
import { useManageCourseMentors } from "@/hooks/hooks";
import { useNavigate } from "@tanstack/react-router";

/**
 * Pillar 4 / Decision 4 — admin-only UI to manage a course's mentor list.
 *
 * `course.mentorIds` is the non-instructor mentor gate. Teachers listed
 * here (but not in `course.instructors`) can access the motivation
 * system's mentor view. See PLAN_MOTIVATION_DECISION4_MENTORIDS.md.
 *
 * Why a separate page from the orphan `course-instructors.tsx`?
 * That page manages enrollment (an unrelated concern). Mentors are
 * decoupled from enrollment — an admin may mentor a course they
 * don't teach. So this is a fresh page with its own route.
 *
 * UI shape:
 * - Top: "Add a mentor by user ID" input + Add button.
 * - Below: list of current mentor user IDs, each with a Remove button.
 * - All access gated by `useAuthStore().user.role === 'admin'`.
 */
export default function CourseMentors() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuthStore();
  const { currentCourse } = useCourseStore();
  const courseId = currentCourse?.courseId;

  const [mentorIds, setMentorIds] = useState<string[]>([]);
  const [newMentorId, setNewMentorId] = useState("");
  // Tracks the initial state loaded from the first mutation's response,
  // so admins see the post-update list without needing a separate GET
  // endpoint. See PLAN_MOTIVATION_DECISION4_MENTORIDS.md, CP-D.
  const [initialLoaded, setInitialLoaded] = useState(false);

  const manageMutation = useManageCourseMentors();

  // Admin gate. Server enforces this too — the controller rejects
  // non-admins with 403. This client check just hides the UI for
  // non-admins so they don't see a confusing page they can't use.
  const isAdmin = hasRole("admin");

  useEffect(() => {
    if (!isAdmin) {
      // Non-admins shouldn't be here at all. Redirect to the main
      // course view so they don't get stuck on a permission-denied page.
      navigate({ to: "/teacher/courses/view" });
    }
  }, [isAdmin, navigate]);

  // If we don't have a course context (the user navigated directly
  // without first selecting a course), nudge them back to the picker.
  useEffect(() => {
    if (!courseId) {
      // Don't auto-redirect on first render — the page may still be
      // hydrating the persisted store. Just show a hint.
    }
  }, [courseId]);

  const handleAdd = async () => {
    const trimmed = newMentorId.trim();
    if (!trimmed) {
      toast.error("User ID cannot be empty");
      return;
    }
    if (!courseId) {
      toast.error("No course selected");
      return;
    }
    if (mentorIds.includes(trimmed)) {
      toast.info(`${trimmed} is already a mentor`);
      setNewMentorId("");
      return;
    }

    try {
      const result = await manageMutation.mutateAsync({
        params: { path: { courseId } },
        body: { add: [trimmed], remove: [] },
      });
      setMentorIds(result.mentorIds);
      setNewMentorId("");
      setInitialLoaded(true);
      toast.success(`Added ${trimmed} as a mentor`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to add mentor");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!courseId) {
      toast.error("No course selected");
      return;
    }
    try {
      const result = await manageMutation.mutateAsync({
        params: { path: { courseId } },
        body: { add: [], remove: [userId] },
      });
      setMentorIds(result.mentorIds);
      setInitialLoaded(true);
      toast.success(`Removed ${userId} from mentors`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove mentor");
    }
  };

  // ── Render guards ──────────────────────────────────────────────────────

  if (!courseId) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Course Mentors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                No course selected. Open a course from your dashboard
                first, then return to this page.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Admin Only
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Managing course mentors requires the admin role. You are
              signed in as <code className="text-xs">{user?.role ?? "unknown"}</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Course Mentors
          </CardTitle>
          <CardDescription>
            Add or remove user IDs from this course&apos;s mentor list.
            Mentors listed here (who are not already course instructors)
            can access the motivation system&apos;s mentor view.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add by user ID */}
          <div className="flex gap-2">
            <Input
              placeholder="Paste a user ID (e.g. 64b7f1f9e4d2f91b7c9a1e23)"
              value={newMentorId}
              onChange={(e) => setNewMentorId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              disabled={manageMutation.isPending}
              className="font-mono text-sm"
            />
            <Button
              onClick={handleAdd}
              disabled={manageMutation.isPending || !newMentorId.trim()}
              className="gap-1"
            >
              {manageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add
            </Button>
          </div>

          {/* Empty state */}
          {mentorIds.length === 0 && !initialLoaded && (
            <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
              No mentors configured yet. Add a user ID above to get started.
              <br />
              <span className="text-xs">
                The current list loads after the first mutation — use the
                audit trail to verify pre-existing mentors.
              </span>
            </div>
          )}

          {mentorIds.length === 0 && initialLoaded && (
            <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
              No mentors configured for this course.
            </div>
          )}

          {/* Current list */}
          {mentorIds.length > 0 && (
            <div className="rounded-md border">
              <ul className="divide-y">
                {mentorIds.map((uid) => (
                  <li
                    key={uid}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="font-mono text-sm break-all pr-2">
                      {uid}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(uid)}
                      disabled={manageMutation.isPending}
                      className="text-destructive hover:text-destructive gap-1"
                      aria-label={`Remove mentor ${uid}`}
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info footer */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p>
                How to find a user ID: open{" "}
                <code>Users</code> in MongoDB Compass and copy the{" "}
                <code>_id</code> field, or use the existing{" "}
                <code>/users/enrollments</code> view to read it from
                the user table.
              </p>
              <p>
                Adding the same user twice is a no-op (the backend uses{" "}
                <code>$addToSet</code>). Removing a user that is not a
                mentor is also a no-op.
              </p>
              <p>
                Every change is recorded in the{" "}
                <a
                  href="/teacher/audit"
                  className="underline hover:text-foreground"
                >
                  audit trail
                </a>{" "}
                (category: COURSE, action: COURSE_UPDATE).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}