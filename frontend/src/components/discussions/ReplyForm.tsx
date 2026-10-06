import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateDiscussionReply } from "@/hooks/discussion-hooks";
import type {
    CreateReplyBody,
    DiscussionError,
    DiscussionReply,
} from "@/types/discussion.types";

interface ReplyFormProps {
    threadId: string;
    /**
     * Called with the freshly-created reply so the parent can prepend
     * it to its list (the canonical flow triggers a full refetch
     * instead, but the optimistic path is also valid).
     */
    onPosted?: (reply: DiscussionReply) => void;
}

/**
 * Inline textarea + submit for posting a reply to a thread.
 *
 * Validation rules mirror the backend's `CreateReplyBody` validator:
 *   - Required, non-whitespace-only body.
 *   - On 400, the field error returned by `class-validator` surfaces
 *     inline under the textarea.
 */
export function ReplyForm({threadId, onPosted}: ReplyFormProps) {
    const [body, setBody] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );
    const [formError, setFormError] = useState<string | null>(null);

    const {mutateAsync, isPending, error: hookError} =
        useCreateDiscussionReply(threadId);

    // Surface hook-level errors that aren't field-scoped.
    useEffect(() => {
        if (!hookError) return;
        if (
            hookError.kind === "validation" &&
            hookError.fieldErrors
        ) {
            setFieldErrors(hookError.fieldErrors);
            setFormError(null);
            return;
        }
        setFieldErrors({});
        setFormError(hookError.message);
    }, [hookError]);

    const bodyMessages = fieldErrors.body ?? [];

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>,
    ) => {
        e.preventDefault();
        setFormError(null);
        setFieldErrors({});

        const trimmed = body.trim();
        if (!trimmed) {
            setFieldErrors({
                body: ["Body cannot be empty or just spaces"],
            });
            return;
        }

        try {
            const payload: CreateReplyBody = {body: trimmed};
            const reply = await mutateAsync(payload);
            setBody("");
            setFieldErrors({});
            setFormError(null);
            onPosted?.(reply);
        } catch (err) {
            // Errors are already surfaced via the hookError effect.
            // Swallow here so we don't crash on the unhandled-rejection
            // path; the user sees inline validation / form errors.
            void (err as DiscussionError);
        }
    };

    return (
        <Card
            data-testid="discussion-reply-form"
            className="border border-border/60"
        >
            <CardContent className="py-3 px-4">
                <form
                    className="space-y-2"
                    onSubmit={handleSubmit}
                    data-testid="discussion-reply-form-element"
                >
                    <Label
                        htmlFor="discussion-reply-body"
                        className="text-xs font-medium"
                    >
                        Add a reply
                    </Label>
                    <Textarea
                        id="discussion-reply-body"
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        placeholder="Share what helped (or what didn't). Markdown / plain text both work."
                        className="min-h-[100px]"
                        disabled={isPending}
                        aria-invalid={bodyMessages.length > 0}
                        data-testid="discussion-reply-body-input"
                    />
                    {bodyMessages.map((msg, idx) => (
                        <p
                            key={idx}
                            className="text-xs text-destructive"
                            data-testid="discussion-reply-body-error"
                        >
                            {msg}
                        </p>
                    ))}
                    {formError && (
                        <p
                            className="text-xs text-destructive"
                            data-testid="discussion-reply-form-error"
                        >
                            {formError}
                        </p>
                    )}
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="gap-2"
                            data-testid="discussion-reply-submit"
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Post reply
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}