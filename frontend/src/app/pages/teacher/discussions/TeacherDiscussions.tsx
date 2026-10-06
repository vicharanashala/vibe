import { MessagesSquare } from "lucide-react";

import { DiscussionList } from "@/components/discussions/DiscussionList";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCourseStore } from "@/store/course-store";

/**
 * Teacher-side discussion list page.
 *
 * Lives inside the teacher layout (`/teacher/...`) so the existing
 * `AppSidebar` and main content panel render around it, exactly like the
 * announcement list does.
 *
 * The course + cohort are pulled from `useCourseStore` rather than from
 * the URL so navigation within a course context "just works" after the
 * teacher opens `/teacher/courses/view`.
 */
export default function TeacherDiscussions() {
    const { currentCourse } = useCourseStore();

    if (!currentCourse?.courseId) {
        return (
            <div className="flex-1 min-w-0">
                <div className="space-y-6">
                    <PageHeader
                        title="Discussions"
                        description="Conversations with everyone in your course"
                    />
                    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
                        <MessagesSquare className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-muted-foreground">
                            Open a course to view its discussions
                        </h3>
                        <p className="text-sm text-muted-foreground/80 max-w-sm mx-auto mt-1">
                            Pick a course from your dashboard to start a thread.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <DiscussionList
            courseId={currentCourse.courseId}
            cohortId={currentCourse.cohortId ?? null}
            threadHrefBuilder={threadId =>
                `/teacher/courses/${currentCourse.courseId}/discussions/${threadId}`
            }
        />
    );
}