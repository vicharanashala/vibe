// Fetch/SSE client for the `exam-genai` backend module. Follows the same
// shape as `frontend/src/lib/api/exams.ts` (apiFetch<T>() helper, bearer
// token from localStorage) plus the SSE pattern from
// `frontend/src/lib/genai-api.ts`'s `connectToLiveStatusUpdates` (native
// EventSource can't send an Authorization header, so this uses the same
// `event-source-polyfill` package that file already depends on).
import { EventSourcePolyfill } from 'event-source-polyfill';

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/exam-genai`;

function getAuthToken(): string | null {
    return localStorage.getItem('firebase-auth-token');
}

function getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
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

// ─── Types ──────────────────────────────────────────────

export type ExamGenSubject =
    | 'mathematics'
    | 'computer_science'
    | 'chemistry'
    | 'statistics'
    | 'physics'
    | 'economics'
    | 'other';

export type ExamGenDifficultyLevel = 'easy' | 'medium' | 'hard' | 'mixed';

export interface GenerateQuestionsInput {
    course_name: string;
    subject: ExamGenSubject;
    course_description: string;
    syllabus: string;
    past_exam_content?: string;
    num_questions?: 5 | 10 | 15;
    difficulty_level?: ExamGenDifficultyLevel;
}

export interface GeneratedQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    difficulty: number;
    key_concepts: string[];
}

export interface ExamGenLastQuestion {
    question: string;
    verdict: 'Keep' | 'Remove';
    difficulty: number;
}

export type ExamGenProgressEvent =
    | {
          stage: 'generating';
          good_count: number;
          bad_count: number;
          iteration: number;
          provider?: string;
          model?: string;
          last_question?: ExamGenLastQuestion;
      }
    | { stage: 'final_judging'; question_index: number; total: number }
    | { stage: 'complete'; questions: GeneratedQuestion[] }
    | { stage: 'error'; message: string };

// ─── API ──────────────────────────────────────────────

export const examGenAIApi = {
    /** Kicks off generation, returns immediately with a jobId. */
    async generate(input: GenerateQuestionsInput): Promise<{ jobId: string }> {
        return apiFetch(`${BASE_URL}/generate`, { method: 'POST', body: JSON.stringify(input) });
    },

    /**
     * Opens the SSE stream for a job. Returns the EventSource so the caller
     * can close it (e.g. on unmount); `onEvent` is invoked for every
     * progress/complete/error payload.
     */
    connectLive(jobId: string, onEvent: (event: ExamGenProgressEvent) => void): EventSource {
        const url = `${BASE_URL}/${jobId}/live`;
        const source = new EventSourcePolyfill(url, {
            headers: getAuthHeaders() as Record<string, string>,
            heartbeatTimeout: 180000,
        }) as unknown as EventSource;
        source.addEventListener('progress', (event) => {
            try {
                onEvent(JSON.parse((event as MessageEvent).data));
            } catch {
                /* malformed/heartbeat frame — ignore */
            }
        });
        source.onerror = (err) => console.warn('[examGenAI] SSE error/reconnecting:', err);
        return source;
    },

    async save(
        jobId: string,
        opts: { target: 'draft' | 'exam' | 'bank'; examId?: string | null; selectedIndices?: number[] },
    ): Promise<{ saved: boolean; target?: string; examId?: string | null; bankEntryIds?: string[]; count: number; message?: string }> {
        return apiFetch(`${BASE_URL}/${jobId}/save`, {
            method: 'POST',
            body: JSON.stringify({
                target: opts.target,
                exam_id: opts.examId || undefined,
                selected_indices: opts.selectedIndices,
            }),
        });
    },

    async listDrafts(): Promise<any[]> {
        return apiFetch(`${BASE_URL}/drafts`);
    },
};
