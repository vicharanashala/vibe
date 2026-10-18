import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateDiscussionThread } from "@/hooks/discussion-hooks";
import type {
    CreateDiscussionBody,
    DiscussionError,
    DiscussionThread,
} from "@/types/discussion.types";

/**
 * One cohort the teacher may post into, surfaced as a `<Select>` option
 * when the course version has more than one. The parent resolves this
 * from the teacher's `INSTRUCTOR` enrollments on the current course.
 */
export interface AvailableCohort {
    id: string;
    name: string;
}

interface CreateDiscussionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: string;
    /**
     * Initial cohort selection — used as the default if the caller didn't
     * pass `availableCohorts` (or only passed one matching cohort).
     * The backend re-derives the caller's authorised scope server-side, so
     * this is treated as a request, not a grant.
     */
    cohortId: string | null;
    /**
     * Cohorts the teacher is enrolled in on this course. When length is 0,
     * the form is disabled and a "no cohort" message is shown. When length
     * is 1, the single cohort is auto-selected and the picker is hidden.
     * When length > 1, a `<Select>` is rendered so the teacher explicitly
     * picks which cohort to post into. Cross-cohort access is blocked by
     * the backend (Milestone C/D discussionService.assertCohortWritable).
     */
    availableCohorts?: AvailableCohort[];
    /**
     * Called with the freshly-created thread so the parent can navigate to
     * its detail page. The hook will already have unwound `isPending`.
     */
    onCreated?: (thread: DiscussionThread) => void;
}

/**
 * Modal form to create a new discussion thread.
 *
 * - Title: required, ≤ 200 characters (mirrors `CreateThreadBody`).
 * - Body:  required (mirrors `CreateThreadBody`).
 * - cohortId: required by the backend, taken from the prop (resolved by
 *   the caller from `useCourseStore.currentCourse.cohortId`).
 *
 * Validation errors come back as `DiscussionError.fieldErrors` and are
 * surfaced inline under each input, with the same wording the backend
 * returns.
 */
export function CreateDiscussionDialog({
    open,
    onOpenChange,
    courseId,
    cohortId,
    onCreated,
}: CreateDiscussionDialogProps) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);

    const { mutateAsync, isPending, error: hookError } = useCreateDiscussionThread(courseId);

    // Local cohort state. Initialised from the prop on first open and
    // any time the availableCohorts list changes (e.g. the parent learns
    // about a freshly-fetched cohort list). Mirrors the legacy
    // cohortId-prop path for callers that don't pass availableCohorts.
    const cohorts = availableCohorts ?? [];
    const [selectedCohortId, setSelectedCohortId] = useState<string | null>(
        cohortId ?? cohorts[0]?.id ?? null,
    );
    useEffect(() => {
        if (!open) return;
        // Pick the first cohort the caller is authorised in. If the caller
        // passed a legacy `cohortId` that's still in the list, prefer it.
        if (cohortId && cohorts.some(c => c.id === cohortId)) {
            setSelectedCohortId(cohortId);
            return;
        }
        setSelectedCohortId(cohorts[0]?.id ?? cohortId ?? null);
        setFieldErrors({});
        setFormError(null);
    }, [open, cohorts, cohortId]);

    // Reset local form state every time the dialog re-opens.
    useEffect(() => {
        if (open) {
            setTitle("");
            setBody("");
            setFieldErrors({});
            setFormError(null);
        }
    }, [open]);

    // Surface hook-level errors that aren't field-scoped.
    useEffect(() => {
        if (!hookError) return;
        if (hookError.kind === "validation" && hookError.fieldErrors) {
            setFieldErrors(hookError.fieldErrors);
            setFormError(null);
            return;
        }
        setFieldErrors({});
        setFormError(hookError.message);
    }, [hookError]);

    const titleMessages = fieldErrors.title ?? [];
    const bodyMessages = fieldErrors.body ?? [];
    const cohortMessages = fieldErrors.cohortId ?? [];

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError(null);
        setFieldErrors({});

        if (!selectedCohortId) {
            setFormError(
                cohorts.length === 0
                    ? "You are not enrolled in any cohort for this course. Ask an administrator to enrol you before posting."
                    : "Pick a cohort before starting a discussion.",
            );
            return;
        }

        const payload: CreateDiscussionBody = {
            title: title.trim(),
            body: body.trim(),
            cohortId: selectedCohortId,
        };

        try {
            const thread = await mutateAsync(payload);
            onOpenChange(false);
            onCreated?.(thread);
        } catch (err) {
            const discussionErr = err as DiscussionError;
            if (discussionErr.kind === "validation" && discussionErr.fieldErrors) {
                setFieldErrors(discussionErr.fieldErrors);
                return;
            }
            setFormError(discussionErr.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[525px]"
                data-testid="create-discussion-dialog"
            >
                <DialogHeader>
                    <DialogTitle>Start a new discussion</DialogTitle>
                    <DialogDescription>
                        Posts a thread visible to everyone in your cohort.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    {cohorts.length > 1 && (
                        <div className="space-y-2">
                            <Label htmlFor="discussion-cohort">Cohort</Label>
                            <Select
                                value={selectedCohortId ?? undefined}
                                onValueChange={value =>
                                    setSelectedCohortId(value)
                                }
                                disabled={isPending}
                            >
                                <SelectTrigger
                                    id="discussion-cohort"
                                    data-testid="create-discussion-cohort-trigger"
                                >
                                    <SelectValue placeholder="Pick a cohort" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cohorts.map(c => (
                                        <SelectItem
                                            key={c.id}
                                            value={c.id}
                                            data-testid={`create-discussion-cohort-option-${c.id}`}
                                        >
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Only members of the chosen cohort will see this thread.
                            </p>
                        </div>
                    )}
                    {cohorts.length === 0 && (
                        <p
                            className="text-xs text-destructive"
                            data-testid="create-discussion-no-cohort"
                        >
                            You are not enrolled in any cohort for this course. Ask an
                            administrator to enrol you before posting.
                        </p>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="discussion-title">Title</Label>
                        <Input
                            id="discussion-title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="What's on your mind?"
                            maxLength={200}
                            disabled={isPending}
                            aria-invalid={titleMessages.length > 0}
                            data-testid="create-discussion-title"
                        />
                        {titleMessages.map((msg, idx) => (
                            <p
                                key={idx}
                                className="text-xs text-destructive"
                                data-testid="create-discussion-title-error"
                            >
                                {msg}
                            </p>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="discussion-body">Body</Label>
                        <Textarea
                            id="discussion-body"
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Share the details. Markdown / plain text both work."
                            className="min-h-[140px]"
                            disabled={isPending}
                            aria-invalid={bodyMessages.length > 0}
                            data-testid="create-discussion-body"
                        />
                        {bodyMessages.map((msg, idx) => (
                            <p
                                key={idx}
                                className="text-xs text-destructive"
                                data-testid="create-discussion-body-error"
                            >
                                {msg}
                            </p>
                        ))}
                    </div>

                    {cohortMessages.length > 0 && (
                        <p className="text-xs text-destructive">
                            {cohortMessages.join(" ")}
                        </p>
                    )}

                    {formError && (
                        <p
                            className="text-xs text-destructive"
                            data-testid="create-discussion-form-error"
                        >
                            {formError}
                        </p>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="min-w-[120px]"
                            data-testid="create-discussion-submit"
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Post thread"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}