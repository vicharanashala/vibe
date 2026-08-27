// Fetch client for the `exams` backend module. Follows the same shape as
// `frontend/src/lib/api/hp-system.ts` (apiFetch<T>() helper, bearer token
// from localStorage, credentials included).
//
// NOTE on ids: Mongo documents come back over the wire with `_id` (string,
// after ObjectId -> JSON), not `id`. The rest of the exam UI (AdminPage,
// EditExamPage, ExamPage, ResultPage, MyTestsPage) was written against the
// old localStorage shape, which used `id` everywhere. Rather than rewrite
// every call site, every exam/attempt returned from this client gets an
// `id` alias added (`id === _id`) so existing UI code keeps working
// unchanged. Nested question ids / time-grant ids are already `id` on the
// backend (see backend/src/modules/exams/classes/transformers/Exam.ts) so
// no aliasing is needed there.

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/exams`;

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('firebase-auth-token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
        credentials: 'include',
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err: any = new Error(errData.message || `Request failed (${res.status})`);
        err.response = { json: async () => errData };
        err.data = errData;
        throw err;
    }
    return res.json();
}

// ─── Interfaces ──────────────────────────────────────────────

export type ExamQuestionType = 'MCQ' | 'MSQ' | 'NAT';

export type NegativeMarkingSchemeValue = 'none' | 'one_third' | 'one_fourth' | 'full' | 'custom';

export interface NegativeMarkingScheme {
    MCQ: NegativeMarkingSchemeValue;
    MSQ: NegativeMarkingSchemeValue;
    NAT: NegativeMarkingSchemeValue;
}

export interface ExamQuestionOption {
    id: string;
    text: string;
    image?: string;
}

export interface ExamQuestion {
    id: string;
    type: ExamQuestionType;
    questionText: string;
    questionImage?: string;
    options: ExamQuestionOption[];
    /** For NAT, a single-element array holding the numeric answer as a string. */
    correctOptions: string[];
    marks: number;
    negativeMarks: number;
    useCustomNegative: boolean;
    natAnswerType?: string;
    /** Shown to students on the result page after results, when reveal is on. */
    explanation?: string;
    /** Short label used to group questions for the per-topic score breakdown. */
    topic?: string;
}

export interface TimeGrant {
    id: string;
    code: string;
    minutes: number;
    note: string;
    used: boolean;
    usedAt: number | null;
    createdAt: number;
}

// Same 8 component keys as `ProctoringComponent` in the course-side settings
// (backend/src/shared/database/interfaces/ISettingRepository.ts), reused here
// for naming consistency even though this is a separate, exam-scoped config
// object (not routed through CourseSettingService).
export interface ProctoringDetectorSetting {
    detectorName: string;
    enabled: boolean;
}

export interface ExamProctoringConfig {
    detectors: ProctoringDetectorSetting[];
}

/** A single logged proctoring violation, submitted with the attempt. */
export interface ProctoringEvent {
    type: string;
    at: number;
    /**
     * Downscaled JPEG evidence thumbnail (base64 data URL) captured from the
     * candidate's camera preview at the moment this violation was flagged.
     * Only present for the serious "blocking" anomaly types (noFace,
     * cameraOff, multipleFaces, voiceDetection, faceRecognition) and only
     * when a camera frame was actually available to capture — absent for
     * softer signals (blurDetection, cameraIntegrity) and whenever there was
     * nothing to screenshot.
     */
    imageDataUrl?: string;
}

export type ExamEligibilityMode = 'none' | 'completion' | 'manual';

/**
 * Admin-configured gate on which students can see/open this exam. The field
 * being absent entirely means hidden — nobody has decided who this exam is
 * for yet, so no student sees it even once published. `mode: "none"` is the
 * explicit opt-in for "Everyone" (saved from "Who can see this exam").
 */
export interface ExamEligibility {
    mode: ExamEligibilityMode;
    /** Course id to check completion against (mode "completion"). */
    courseId?: string;
    /** Optional course version id, to scope completion to one version. */
    courseVersionId?: string;
    /** Minimum course completion percentage required (mode "completion"). */
    minCompletionPercent?: number;
    /** Student emails allowed to see this exam (mode "manual"). */
    allowedEmails?: string[];
}

export interface Exam {
    _id: string;
    /** Alias for `_id` — see the note at the top of this file. */
    id: string;
    title: string;
    duration: number;
    passingMarks: number;
    negativeMarking: boolean;
    negativeMarkingScheme: NegativeMarkingScheme;
    instructions: string;
    published: boolean;
    revealAnswers?: boolean;
    /** Teacher-configured camera/mic proctoring detectors for this exam. */
    proctoring?: ExamProctoringConfig;
    /** Epoch-ms. Unset means "always open" (no lower bound). */
    opensAt?: number;
    /** Epoch-ms. Unset means "never closes" (no upper bound). */
    closesAt?: number;
    /** Whether a student may attempt this exam more than once. Server defaults to `true` when omitted. */
    allowRetakes?: boolean;
    /** Admin-configured visibility gate — see `ExamEligibility`. */
    eligibility?: ExamEligibility;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    questions: ExamQuestion[];
    timeGrants: TimeGrant[];
}

export interface AttemptResponseItem {
    questionId: string;
    selectedOptionIds?: string[];
    natValue?: string;
    isMarkedForReview?: boolean;
    isAnswered?: boolean;
    visited?: boolean;
}

export interface AttemptAnswerEntry {
    correct: string[] | string;
}

export interface ExamAttempt {
    _id: string;
    /** Alias for `_id` — see the note at the top of this file. */
    id: string;
    examId: string;
    examTitle: string;
    studentId: string;
    /** Snapshotted from the submitting user at attempt time — may be absent on attempts submitted before this field existed. */
    studentName?: string;
    studentEmail?: string;
    responses: AttemptResponseItem[];
    /** Snapshot of `exam.questions` at submit time. */
    questions: ExamQuestion[];
    answers: Record<string, AttemptAnswerEntry>;
    score: number;
    totalMarks: number;
    correctCount: number;
    total: number;
    revealAnswers: boolean;
    tabSwitches?: number;
    startedAt?: number;
    /** Camera/mic proctoring violations logged during this attempt (audit trail, not graded). */
    proctoringEvents?: ProctoringEvent[];
    submittedAt: number;
}

export interface RedeemGrantResponse {
    ok: boolean;
    minutes?: number;
    error?: string;
}

// ─── Request payloads ───────────────────────────────────────

export interface TimeGrantSeedInput {
    minutes: number;
    note?: string;
}

export interface CreateExamInput {
    title: string;
    duration?: number;
    passingMarks?: number;
    negativeMarking?: boolean;
    negativeMarkingScheme?: NegativeMarkingScheme;
    instructions?: string;
    revealAnswers?: boolean;
    proctoring?: ExamProctoringConfig;
    opensAt?: number;
    closesAt?: number;
    allowRetakes?: boolean;
    eligibility?: ExamEligibility;
    timeGrants?: TimeGrantSeedInput[];
}

export type UpdateExamInput = Partial<
    Omit<CreateExamInput, 'timeGrants' | 'opensAt' | 'closesAt'> & {
        published: boolean;
        /** `null` clears a previously-set bound (mapped from an emptied datetime-local input). */
        opensAt: number | null;
        closesAt: number | null;
    }
>;

export interface AddQuestionInput {
    type: ExamQuestionType;
    questionText: string;
    questionImage?: string;
    options?: ExamQuestionOption[];
    correctOptions: string[];
    marks: number;
    negativeMarks?: number;
    useCustomNegative?: boolean;
    natAnswerType?: string;
    explanation?: string;
    topic?: string;
}

export type UpdateQuestionInput = Partial<AddQuestionInput>;

/**
 * A single reusable question in a teacher's own question bank — same shape
 * as `ExamQuestion` (including its `id`, which is the bank-scoped
 * `bank-<uuid>` assigned by `QuestionBankService.addToBank`, NOT reused when
 * the entry is copied into an exam) plus the Mongo `_id` and ownership/audit
 * fields. `_id` (not `id`) is what `removeFromQuestionBank` and
 * `addQuestionsFromBank`'s `questionIds` expect — see
 * `QuestionBankRepository` on the backend, which keys every lookup off the
 * Mongo document id.
 */
export interface QuestionBankEntry extends ExamQuestion {
    _id: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
}

export interface AddTimeGrantInput {
    minutes: number;
    note?: string;
}

export interface SubmitAttemptInput {
    responses: AttemptResponseItem[];
    tabSwitches?: number;
    startedAt?: number;
    proctoringEvents?: ProctoringEvent[];
}

// ─── id-aliasing helpers ─────────────────────────────────────

function withId<T extends { _id: string }>(doc: T): T & { id: string } {
    return { ...doc, id: doc._id };
}

function withIds<T extends { _id: string }>(docs: T[]): (T & { id: string })[] {
    return docs.map(withId);
}

// ─── API functions ───────────────────────────────────────────

export const examApi = {
    // ── Exams ────────────────────────────────────────────────

    getMyExams: async (): Promise<Exam[]> => {
        const data = await apiFetch<Exam[]>(`${BASE_URL}`);
        return withIds(data);
    },

    getPublishedExams: async (): Promise<Exam[]> => {
        const data = await apiFetch<Exam[]>(`${BASE_URL}/published`);
        return withIds(data);
    },

    getExam: async (examId: string): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}`);
        return withId(data);
    },

    createExam: async (input: CreateExamInput): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return withId(data);
    },

    updateExam: async (examId: string, patch: UpdateExamInput): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
        return withId(data);
    },

    deleteExam: async (examId: string): Promise<{ success: boolean }> => {
        return apiFetch(`${BASE_URL}/${examId}`, { method: 'DELETE' });
    },

    // ── Questions ────────────────────────────────────────────

    addQuestion: async (examId: string, input: AddQuestionInput): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}/questions`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return withId(data);
    },

    updateQuestion: async (
        examId: string,
        questionId: string,
        patch: UpdateQuestionInput,
    ): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}/questions/${questionId}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
        return withId(data);
    },

    removeQuestion: async (examId: string, questionId: string): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}/questions/${questionId}`, {
            method: 'DELETE',
        });
        return withId(data);
    },

    // ── Question bank ────────────────────────────────────────
    // Note: bank entries already come back with both `_id` and `id` set
    // natively by the backend (see `QuestionBankEntry` doc comment above),
    // unlike `Exam`/`ExamAttempt` — so none of these need the `withId`
    // aliasing helper.

    listQuestionBank: async (params?: { topic?: string; type?: string }): Promise<QuestionBankEntry[]> => {
        const qs = new URLSearchParams();
        if (params?.topic) qs.set('topic', params.topic);
        if (params?.type) qs.set('type', params.type);
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return apiFetch<QuestionBankEntry[]>(`${BASE_URL}/question-bank${suffix}`);
    },

    addToQuestionBank: async (input: AddQuestionInput): Promise<QuestionBankEntry> => {
        return apiFetch<QuestionBankEntry>(`${BASE_URL}/question-bank`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    removeFromQuestionBank: async (questionId: string): Promise<{ success: boolean }> => {
        return apiFetch(`${BASE_URL}/question-bank/${questionId}`, { method: 'DELETE' });
    },

    addQuestionsFromBank: async (examId: string, questionIds: string[]): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}/questions/from-bank`, {
            method: 'POST',
            body: JSON.stringify({ questionIds }),
        });
        return withId(data);
    },

    bulkAddQuestions: async (examId: string, questions: AddQuestionInput[]): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}/questions/bulk`, {
            method: 'POST',
            body: JSON.stringify({ questions }),
        });
        return withId(data);
    },

    // ── Time grants ──────────────────────────────────────────

    addTimeGrant: async (examId: string, input: AddTimeGrantInput): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}/time-grants`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return withId(data);
    },

    removeTimeGrant: async (examId: string, grantId: string): Promise<Exam> => {
        const data = await apiFetch<Exam>(`${BASE_URL}/${examId}/time-grants/${grantId}`, {
            method: 'DELETE',
        });
        return withId(data);
    },

    redeemTimeGrant: async (examId: string, code: string): Promise<RedeemGrantResponse> => {
        return apiFetch(`${BASE_URL}/${examId}/redeem-grant`, {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
    },

    // ── Attempts ─────────────────────────────────────────────

    submitAttempt: async (examId: string, input: SubmitAttemptInput): Promise<ExamAttempt> => {
        const data = await apiFetch<ExamAttempt>(`${BASE_URL}/${examId}/attempts`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return withId(data);
    },

    getMyAttempts: async (): Promise<ExamAttempt[]> => {
        const data = await apiFetch<ExamAttempt[]>(`${BASE_URL}/attempts/mine`);
        return withIds(data);
    },

    getAttempt: async (attemptId: string): Promise<ExamAttempt> => {
        const data = await apiFetch<ExamAttempt>(`${BASE_URL}/attempts/${attemptId}`);
        return withId(data);
    },

    // Teacher-facing: all attempts for a single exam (owner or admin only,
    // 403 otherwise). Newest first, per the backend's findByExam ordering.
    listAttemptsForExam: async (examId: string): Promise<ExamAttempt[]> => {
        const data = await apiFetch<ExamAttempt[]>(`${BASE_URL}/${examId}/attempts`);
        return withIds(data);
    },
};
