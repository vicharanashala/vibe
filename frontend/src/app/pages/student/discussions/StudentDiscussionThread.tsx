import { ThreadView } from "@/components/discussions/ThreadView";
import { useParams } from "@tanstack/react-router";

/**
 * Student-side discussion thread detail page.
 *
 * Sibling of `StudentDiscussions`; lives inside the same `/student/...`
 * layout so the existing sidebar / main content panel wrap it.
 *
 * Milestone E fix: read the `:courseId` and `:threadId` path params via
 * TanStack Router's `useParams` (the previous prop-based approach silently
 * received `undefined` because TanStack Router only auto-passes matched
 * params when the route is declared with `parseParams`).
 */
export default function StudentDiscussionThread() {
    const { courseId, threadId } = useParams({
        from: "/student/courses/$courseId/discussions/$threadId",
    });
    return (
        <ThreadView
            threadId={threadId}
            listHref={`/student/courses/${courseId}/discussions`}
        />
    );
}
