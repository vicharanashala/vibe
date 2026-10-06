import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateDiscussionThread } from "@/hooks/discussion-hooks";
import type {
    DiscussionError,
    DiscussionThread,
    UpdateThreadBody,
} from "@/types/discussion.types";

interface EditThreadFormProps {
    thread: DiscussionThread;
    onSaved: (thread: DiscussionThread) => void;
    onCancel: () => void;
}

/**
 * Inline edit form for a thread. Mirrors the `CreateDiscussionDialog`
 * validation surface (`title` and `body` both required and non-blank),
 * but submits via the Milestone C `useUpdateDiscussionThread` hook.
 *
 * The form is intentionally not a Dialog — the existing Milestone B
 * `ThreadView` layout is the parent, and editing in-place inside the
 * thread card avoids disrupting the surrounding layout.
 */
export function EditThreadForm({
    thread,
    onSaved,
    onCancel,
}: EditThreadFormProps) {
    const [title, setTitle] = useState(thread.title);
    const [body, setBody] = useState(thread.body);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );
    const [formError, setFormError] = useState<string | null>(null);

    const {mutateAsync, isPending, error: hookError} =
        useUpdateDiscussionThread();

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

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>,
    ) => {
        e.preventDefault();
        setFormError(null);
        setFieldErrors({});

        const trimmedTitle = title.trim();
        const trimmedBody = body.trim();
        if (!trimmedTitle && !trimmedBody) {
            setFormError(
                "At least one of `title` or `body` must be provided",
            );
            return;
        }
        if (!trimmedTitle) {
            setFieldErrors({title: ["Title cannot be empty or just spaces"]});
            return;
        }
        if (!trimmedBody) {
            setFieldErrors({body: ["Body cannot be empty or just spaces"]});
            return;
        }

        const payload: UpdateThreadBody = {
            title: trimmedTitle,
            body: trimmedBody,
        };

        try {
            const updated = await mutateAsync(thread._id, payload);
            onSaved(updated);
        } catch (err) {
            void (err as DiscussionError);
        }
    };

    return (
        <Card
            data-testid="discussion-edit-thread-form"
            className="border border-border/60"
        >
            <CardContent className="py-4 px-4">
                <form
                    className="space-y-3"
                    onSubmit={handleSubmit}
                    data-testid="discussion-edit-thread-form-element"
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                            Edit thread
                        </h3>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={onCancel}
                            aria-label="Cancel edit"
                            data-testid="discussion-edit-thread-cancel"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label
                            htmlFor="edit-thread-title"
                            className="text-xs font-medium"
                        >
                            Title
                        </Label>
                        <Input
                            id="edit-thread-title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Title"
                            maxLength={200}
                            disabled={isPending}
                            aria-invalid={titleMessages.length > 0}
                            data-testid="edit-thread-title"
                        />
                        {titleMessages.map((msg, idx) => (
                            <p
                                key={idx}
                                className="text-xs text-destructive"
                                data-testid="edit-thread-title-error"
                            >
                                {msg}
                            </p>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <Label
                            htmlFor="edit-thread-body"
                            className="text-xs font-medium"
                        >
                            Body
                        </Label>
                        <Textarea
                            id="edit-thread-body"
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Body"
                            className="min-h-[120px]"
                            disabled={isPending}
                            aria-invalid={bodyMessages.length > 0}
                            data-testid="edit-thread-body"
                        />
                        {bodyMessages.map((msg, idx) => (
                            <p
                                key={idx}
                                className="text-xs text-destructive"
                                data-testid="edit-thread-body-error"
                            >
                                {msg}
                            </p>
                        ))}
                    </div>

                    {formError && (
                        <p
                            className="text-xs text-destructive"
                            data-testid="edit-thread-form-error"
                        >
                            {formError}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={isPending}
                            data-testid="edit-thread-cancel-button"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="min-w-[100px]"
                            data-testid="edit-thread-submit"
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Save changes"
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}