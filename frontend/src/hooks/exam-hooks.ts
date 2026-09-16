import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { examApi } from '@/lib/api/exams';
import type {
    AddQuestionInput,
    AddTimeGrantInput,
    CreateExamInput,
    Exam,
    SubmitAttemptInput,
    UpdateExamInput,
    UpdateQuestionInput,
} from '@/lib/api/exams';

// Query keys, centralized so mutations below can invalidate consistently.
export const examKeys = {
    mine: ['exams', 'mine'] as const,
    published: ['exams', 'published'] as const,
    exam: (examId?: string) => ['exam', examId] as const,
    myAttempts: ['exams', 'attempts', 'mine'] as const,
    attempt: (attemptId?: string) => ['exam-attempt', attemptId] as const,
    examAttempts: (examId?: string) => ['exams', examId, 'attempts'] as const,
    // Params-aware, but the UI only ever calls `useQuestionBank()` with no
    // params (fetches everything once, filters client-side — see
    // EditExamPage's bank browser) so in practice this always resolves to
    // the same `['exams', 'question-bank', null, null]` key, which is what
    // the mutations below invalidate.
    questionBank: (params?: { topic?: string; type?: string }) =>
        ['exams', 'question-bank', params?.topic ?? null, params?.type ?? null] as const,
};

// ── Exams ──────────────────────────────────────────────────

export function useMyExams() {
    return useQuery({
        queryKey: examKeys.mine,
        queryFn: examApi.getMyExams,
    });
}

export function usePublishedExams() {
    return useQuery({
        queryKey: examKeys.published,
        queryFn: examApi.getPublishedExams,
    });
}

export function useExam(examId?: string) {
    return useQuery({
        queryKey: examKeys.exam(examId),
        queryFn: () => examApi.getExam(examId!),
        enabled: Boolean(examId),
    });
}

export function useCreateExam() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateExamInput) => examApi.createExam(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: examKeys.mine });
            void queryClient.invalidateQueries({ queryKey: examKeys.published });
        },
    });
}

export function useUpdateExam() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; patch: UpdateExamInput }) =>
            examApi.updateExam(input.examId, input.patch),
        onSuccess: (exam: Exam) => {
            void queryClient.invalidateQueries({ queryKey: examKeys.mine });
            void queryClient.invalidateQueries({ queryKey: examKeys.published });
            void queryClient.invalidateQueries({ queryKey: examKeys.exam(exam.id) });
        },
    });
}

export function useDeleteExam() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (examId: string) => examApi.deleteExam(examId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: examKeys.mine });
            void queryClient.invalidateQueries({ queryKey: examKeys.published });
        },
    });
}

// ── Questions ──────────────────────────────────────────────

export function useAddQuestion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; question: AddQuestionInput }) =>
            examApi.addQuestion(input.examId, input.question),
        onSuccess: (exam: Exam) => {
            void queryClient.invalidateQueries({ queryKey: examKeys.exam(exam.id) });
            void queryClient.invalidateQueries({ queryKey: examKeys.mine });
        },
    });
}

export function useUpdateQuestion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; questionId: string; patch: UpdateQuestionInput }) =>
            examApi.updateQuestion(input.examId, input.questionId, input.patch),
        onSuccess: (exam: Exam) => {
            void queryClient.invalidateQueries({ queryKey: examKeys.exam(exam.id) });
            void queryClient.invalidateQueries({ queryKey: examKeys.mine });
        },
    });
}

export function useRemoveQuestion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; questionId: string }) =>
            examApi.removeQuestion(input.examId, input.questionId),
        onSuccess: (exam: Exam) => {
            void queryClient.invalidateQueries({ queryKey: examKeys.exam(exam.id) });
            void queryClient.invalidateQueries({ queryKey: examKeys.mine });
        },
    });
}

// ── Question bank ──────────────────────────────────────────

export function useQuestionBank(params?: { topic?: string; type?: string }) {
    return useQuery({
        queryKey: examKeys.questionBank(params),
        queryFn: () => examApi.listQuestionBank(params),
    });
}

export function useAddToQuestionBank() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: AddQuestionInput) => examApi.addToQuestionBank(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: examKeys.questionBank() });
        },
    });
}

export function useRemoveFromQuestionBank() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (questionId: string) => examApi.removeFromQuestionBank(questionId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: examKeys.questionBank() });
        },
    });
}

export function useAddQuestionsFromBank() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; questionIds: string[] }) =>
            examApi.addQuestionsFromBank(input.examId, input.questionIds),
        onSuccess: (exam: Exam) => {
            void queryClient.invalidateQueries({ queryKey: examKeys.exam(exam.id) });
            void queryClient.invalidateQueries({ queryKey: examKeys.mine });
        },
    });
}

export function useBulkAddQuestions() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; questions: AddQuestionInput[] }) =>
            examApi.bulkAddQuestions(input.examId, input.questions),
        onSuccess: (exam: Exam) => {
            void queryClient.invalidateQueries({ queryKey: examKeys.exam(exam.id) });
            void queryClient.invalidateQueries({ queryKey: examKeys.mine });
        },
    });
}

// ── Time grants ────────────────────────────────────────────

export function useAddTimeGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; grant: AddTimeGrantInput }) =>
            examApi.addTimeGrant(input.examId, input.grant),
        onSuccess: (exam: Exam) => {
            void queryClient.invalidateQueries({ queryKey: examKeys.exam(exam.id) });
        },
    });
}

export function useRemoveTimeGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; grantId: string }) =>
            examApi.removeTimeGrant(input.examId, input.grantId),
        onSuccess: (exam: Exam) => {
            void queryClient.invalidateQueries({ queryKey: examKeys.exam(exam.id) });
        },
    });
}

export function useRedeemTimeGrant() {
    return useMutation({
        mutationFn: (input: { examId: string; code: string }) =>
            examApi.redeemTimeGrant(input.examId, input.code),
    });
}

// ── Attempts ───────────────────────────────────────────────

export function useSubmitAttempt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { examId: string; body: SubmitAttemptInput }) =>
            examApi.submitAttempt(input.examId, input.body),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: examKeys.myAttempts });
        },
    });
}

export function useMyAttempts() {
    return useQuery({
        queryKey: examKeys.myAttempts,
        queryFn: examApi.getMyAttempts,
    });
}

export function useAttempt(attemptId?: string) {
    return useQuery({
        queryKey: examKeys.attempt(attemptId),
        queryFn: () => examApi.getAttempt(attemptId!),
        enabled: Boolean(attemptId),
    });
}

// Teacher-facing: every attempt on one exam (see AttemptsPage). 403s for
// non-owners/non-admins — surfaces via the query's isError/error, same as
// any other useQuery here.
export function useExamAttempts(examId?: string) {
    return useQuery({
        queryKey: examKeys.examAttempts(examId),
        queryFn: () => examApi.listAttemptsForExam(examId!),
        enabled: Boolean(examId),
    });
}
