/**
 * TypeScript shapes that mirror the Milestone A discussionBoard backend
 * (see backend/src/modules/discussionBoard/classes/transformers/Discussion.ts).
 *
 * Keep these in lock-step with `DiscussionThreadResponse`,
 * `DiscussionReplyResponse`, `DiscussionThreadDetailResponse` and
 * `CreateThreadBody`. If the backend transformer changes, update here too.
 */

export interface DiscussionThread {
    _id: string;
    courseId: string;
    cohortId: string;
    authorId: string;
    /**
     * Author's Firebase UID, exposed by the backend so the UI can decide
     * whether a thread is "own content" without an extra lookup. The
     * client compares this against `useAuthStore.user.uid`.
     */
    authorFirebaseUid?: string;
    title: string;
    body: string;
    pinned: boolean;
    /** ISO date string from the JSON-serialised Date. */
    createdAt: string;
    updatedAt: string;
}

export interface DiscussionReply {
    _id: string;
    threadId: string;
    authorId: string;
    authorFirebaseUid?: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

export interface DiscussionThreadDetail {
    thread: DiscussionThread;
    replies: DiscussionReply[];
}

/**
 * Body for `POST /course/:courseId/discussions`. Mirrors `CreateThreadBody`.
 *
 * `cohortId` is a request, not a grant — the backend re-derives the caller's
 * authorised scope server-side, so a malicious client can't widen scope by
 * tampering with this value.
 */
export interface CreateDiscussionBody {
    title: string;
    body: string;
    cohortId: string;
}

/**
 * Body for `POST /discussions/:threadId/replies`. Mirrors `CreateReplyBody`.
 */
export interface CreateReplyBody {
    body: string;
}

/**
 * Body for `PATCH /discussions/:threadId`. Mirrors `UpdateThreadBody`.
 */
export interface UpdateThreadBody {
    title?: string;
    body?: string;
}

/**
 * Body for `PATCH /discussions/:threadId/pin`. Mirrors `PinThreadBody`.
 */
export interface PinThreadBody {
    pinned: boolean;
}

/**
 * Validation messages mirror the backend's class-validator decorations on
 * `CreateThreadBody`. Surfaced inline in `CreateDiscussionDialog` when the
 * server responds with 400.
 */
export const DISCUSSION_FIELD_MESSAGES = {
    titleRequired: 'Title is required',
    titleWhitespace: 'Title cannot be empty or just spaces',
    titleTooLong: 'Title must be 200 characters or fewer',
    bodyRequired: 'Body is required',
    bodyWhitespace: 'Body cannot be empty or just spaces',
    cohortIdRequired: 'cohortId is required',
} as const;

/**
 * Coarse-grained error categories the discussion backend can return.
 * Network errors get a generic message; HTTP errors map to one of these so
 * the UI can render a non-generic, user-actionable message.
 */
export type DiscussionErrorKind =
    | 'network'
    | 'unauthenticated'
    | 'forbidden'
    | 'not_found'
    | 'validation'
    | 'server';

export interface DiscussionError {
    kind: DiscussionErrorKind;
    status?: number;
    message: string;
    /** Field-keyed validation messages keyed by backend `errors[].property`. */
    fieldErrors?: Record<string, string[]>;
}