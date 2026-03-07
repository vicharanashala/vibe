// Types based on the backend schema

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/hp`;

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
        throw new Error(errData.message || `Request failed (${res.status})`);
    }
    return res.json();
}

// ─── Interfaces ──────────────────────────────────────────────

export interface CourseVersionStats {
    courseVersionId: string;
    versionName: string;
    totalCohorts: number;
    createdAt?: string;
}

export interface CourseWithVersions {
    courseId: string;
    courseName: string;
    versions: CourseVersionStats[];
}

export interface CohortStats {
    cohortId?: string;
    cohortName: string;
    courseVersionId: string;
    stats: {
        totalStudents: number;
        totalActivities: number;
        publishedActivities: number;
        draftActivities: number;
        totalHpDistributed: number;
        totalCredits: number;
        totalDebits: number;
        pendingApprovals: number;
        overdueActivities: number;
    };
    lastActivityAt: string;
    createdAt?: string;
}

export interface HpActivity {
    _id: string;
    courseVersionId: string;
    courseId: string;
    cohort: string;
    createdByTeacherId?: string;
    publishedByTeacherId?: string;
    instructorName?: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    title: string;
    description: string;
    activityType: "ASSIGNMENT" | "MILESTONE" | "EXTERNAL_IMPORT" | "VIBE_MILESTONE" | "OTHER";
    submissionMode: "IN_PLATFORM" | "EXTERNAL_LINK";
    externalLink?: string;
    attachments?: {
        name: string;
        url: string;
        kind: 'PDF' | 'LINK' | 'OTHER';
    }[];
    stats?: {
        totalStudents: number;
        submittedCount: number;
        completedCount: number;
        overdueCount: number;
        lastRecomputedAt: string;
    };
    rules?: {
        isMandatory: boolean;
        deadlineAt: Date | string;
        allowLateSubmission: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

export interface HpStudent {
    _id: string;
    name: string;
    email: string;
    totalHp: number;
    completionPercentage: number;
    avatar?: string;
}

export interface HpLedgerEntry {
    _id: string;
    studentId: string;
    activityId: string;
    activityTitle: string;
    status: 'SUBMITTED' | 'PENDING' | 'REVERTED';
    submissionLink?: string;
    baseHp: number;
    currentHp: number;
    type: 'CREDIT' | 'DEBIT';
    instructorFeedback?: string;
    submittedAt?: string;
    createdAt: string;
}

export interface HpCohortOverviewStats {
    totalStudents: number;
    totalOverdue: number;
    completionRates: {
        activityId: string;
        activityTitle: string;
        submittedCount: number;
        pendingCount: number;
        revertedCount: number;
        totalAssigned: number;
    }[];
}

export interface SubmissionAttachment {
    _id: string;
    name: string;
    url: string;
    type: 'image' | 'pdf' | 'document' | 'link' | 'other';
}

export interface HpStudentSubmission {
    _id: string;
    activityId: string;
    activityTitle: string;
    activityDescription?: string;
    status: 'SUBMITTED' | 'PENDING' | 'REVERTED';
    attachments: SubmissionAttachment[];
    submissionLink?: string;
    dueDate?: string;
    submittedAt?: string;
    lastUpdated?: string;
    submissionCount: number;
    isLate: boolean;
    baseHp: number;
    currentHp: number;
    instructorFeedback?: string;
    safetyStatus?: 'safe' | 'unsafe';
}

export interface HpRuleConfig {
    _id: string;
    courseId: string;
    courseVersionId: string;
    activityId: string;
    isMandatory: boolean;
    deadlineAt?: string;
    allowLateSubmission?: boolean;
    lateRewardPolicy?: "NONE" | "REWARD_ALLOWED" | "REWARD_DENIED";
    reward?: {
        enabled: boolean;
        type: "ABSOLUTE" | "PERCENTAGE";
        value: number;
        applyWhen: "ON_SUBMISSION" | "ON_APPROVAL";
        onlyWithinDeadline: boolean;
        allowLate: boolean;
        lateBehavior: "NO_REWARD" | "REWARD";
        minHpFloor: number;
    };
    penalty?: {
        enabled: boolean;
        type: "ABSOLUTE" | "PERCENTAGE";
        value: number;
        applyWhen: "AFTER_DEADLINE";
        graceMinutes: number;
        runOnce: boolean;
    };
    limits?: {
        minHp: number;
        maxHp: number;
    };
    createdAt?: string;
    updatedAt?: string;
}

export interface HpStudentActivity {
    _id: string;
    courseVersionId: string;
    courseId: string;
    cohort: string;
    title: string;
    description: string;
    activityType: "ASSIGNMENT" | "MILESTONE" | "EXTERNAL_IMPORT" | "VIBE_MILESTONE" | "OTHER";
    submissionMode: "IN_PLATFORM" | "EXTERNAL_LINK";
    externalLink?: string;
    attachments?: {
        name: string;
        url: string;
        kind: 'PDF' | 'LINK' | 'OTHER';
    }[];
    // Rule details embedded for student view
    isMandatory: boolean;
    deadlineAt?: string;
    allowLateSubmission?: boolean;
    rewardType?: "ABSOLUTE" | "PERCENTAGE";
    rewardValue?: number;
    studentStatus: "NOT_STARTED" | "SUBMITTED" | "GRADED" | "OVERDUE";
}

export interface CreateHpActivityPayload {
    courseId: string;
    courseVersionId: string;
    cohort: string;
    title: string;
    description: string;
    activityType: string;
    submissionMode: string;
    externalLink?: string;
    status?: "DRAFT" | "PUBLISHED";
    deadlineAt?: string;
    allowLateSubmission?: boolean;
    lateRewardPolicy?: string;
    attachments?: { name: string; url: string; kind: string }[];
}

// ─── API Functions ───────────────────────────────────────────

export const hpApi = {

    // ── Courses & Cohorts (mock backend) ──────────────────────

    getCourseVersions: async (): Promise<{ success: boolean; data: CourseWithVersions[] }> => {
        return apiFetch(`${BASE_URL}/courses-cohorts/courses/versions`);
    },

    getCohorts: async (courseVersionId: string): Promise<{ success: boolean; message: string; data: CohortStats[] }> => {
        const params = new URLSearchParams({ courseVersionId });
        return apiFetch(`${BASE_URL}/courses-cohorts/cohorts?${params.toString()}`);
    },

    getStudentCohorts: async (): Promise<{ success: boolean; message: string; data: any[] }> => {
        return apiFetch(`${BASE_URL}/courses-cohorts/cohorts`);
    },

    getStudentActivities: async (
        courseVersionId: string,
        cohortName: string
    ): Promise<{ success: boolean; data: HpActivity[] }> => {
        // Use the existing activities endpoint, filtered to PUBLISHED only for students
        const params = new URLSearchParams({ courseVersionId, cohort: cohortName, status: 'PUBLISHED' });
        return apiFetch(`${BASE_URL}/activities?${params.toString()}`);
    },

    submitActivity: async (options: {
        courseId: string;
        courseVersionId: string;
        cohort: string;
        activityId: string;
        payload: {
            textResponse?: string;
            links?: { url: string; label: string }[];
        };
        submissionSource?: string;
        files?: File[];
        images?: File[];
    }): Promise<{ success: boolean; data: any }> => {
        const { files, images, ...rest } = options;
        const hasFiles = (files && files.length > 0) || (images && images.length > 0);

        if (hasFiles) {
            const formData = new FormData();
            formData.append('courseId', rest.courseId);
            formData.append('courseVersionId', rest.courseVersionId);
            formData.append('cohort', rest.cohort);
            formData.append('activityId', rest.activityId);
            if (rest.submissionSource) {
                formData.append('submissionSource', rest.submissionSource);
            }
            // flatten payload
            if (rest.payload.textResponse) {
                formData.append('payload[textResponse]', rest.payload.textResponse);
            }
            if (rest.payload.links) {
                rest.payload.links.forEach((link, idx) => {
                    formData.append(`payload[links][${idx}][url]`, link.url);
                    formData.append(`payload[links][${idx}][label]`, link.label);
                });
            }

            if (files) {
                files.forEach(f => formData.append('files', f));
            }
            if (images) {
                images.forEach(img => formData.append('images', img));
            }

            const token = localStorage.getItem('firebase-auth-token');
            const res = await fetch(`${BASE_URL}/activity-submissions`, {
                method: 'POST',
                body: formData,
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: 'include',
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Request failed (${res.status})`);
            }
            return res.json();
        }

        return apiFetch(`${BASE_URL}/activity-submissions`, {
            method: 'POST',
            body: JSON.stringify(rest),
        });
    },

    // ── Activities (real backend) ────────────────────────────

    getActivities: async (
        courseVersionId: string,
        cohort: string,
        status?: string,
        search?: string
    ): Promise<{ success: boolean; data: HpActivity[] }> => {
        const params = new URLSearchParams({ courseVersionId, cohort });
        if (status && status !== 'ALL') params.append('status', status);
        if (search) params.append('search', search);

        return apiFetch(`${BASE_URL}/activities?${params.toString()}`);
    },

    getStudentMySubmissions: async (
        courseVersionId: string,
        cohort: string
    ): Promise<{ success: boolean; data: any[] }> => {
        const params = new URLSearchParams({ courseVersionId, cohort });
        // The teacher list endpoint returns the submissions according to the query.
        // It relies on the token if we had a specific student endpoint, but we can reuse the generic list one 
        // if the backend filters it by the token's user ID.
        return apiFetch(`${BASE_URL}/activity-submissions/student/my-submissions?${params.toString()}`);
    },

    createActivity: async (payload: CreateHpActivityPayload): Promise<{ success: boolean; data: HpActivity }> => {
        return apiFetch(`${BASE_URL}/activities`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    updateActivity: async (activityId: string, updates: Partial<HpActivity>): Promise<{ success: boolean; data: HpActivity }> => {
        return apiFetch(`${BASE_URL}/activities/${activityId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    },

    publishActivity: async (activityId: string): Promise<{ success: boolean; data: HpActivity }> => {
        return apiFetch(`${BASE_URL}/activities/${activityId}/publish`, {
            method: 'POST',
        });
    },

    archiveActivity: async (activityId: string): Promise<{ success: boolean; data: HpActivity }> => {
        return apiFetch(`${BASE_URL}/activities/${activityId}/archive`, {
            method: 'POST',
        });
    },

    getActivityById: async (activityId: string): Promise<{ success: boolean; data: HpActivity }> => {
        return apiFetch(`${BASE_URL}/activities/${activityId}`);
    },

    deleteActivity: async (activityId: string): Promise<{ success: boolean }> => {
        // Backend does not have a DELETE endpoint; archive instead
        return apiFetch(`${BASE_URL}/activities/${activityId}/archive`, {
            method: 'POST',
        });
    },

    // ── Rule Configs (real backend) ──────────────────────────

    getRuleConfigByActivityId: async (activityId: string): Promise<{ success: boolean; data: HpRuleConfig | null }> => {
        return apiFetch(`${BASE_URL}/rule-config/activity/${activityId}`);
    },

    getRuleConfigById: async (ruleConfigId: string): Promise<{ success: boolean; data: HpRuleConfig }> => {
        return apiFetch(`${BASE_URL}/rule-config/${ruleConfigId}`);
    },

    createRuleConfig: async (payload: Partial<HpRuleConfig>): Promise<{ success: boolean; data: HpRuleConfig }> => {
        return apiFetch(`${BASE_URL}/rule-config`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    updateRuleConfig: async (ruleConfigId: string, updates: Partial<HpRuleConfig>): Promise<{ success: boolean; data: HpRuleConfig }> => {
        return apiFetch(`${BASE_URL}/rule-config/${ruleConfigId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    // ── Legacy compatibility shim (kept for RuleSettingsDialog) ──
    getRuleConfigs: async (_courseVersionId: string, _cohort: string): Promise<{ success: boolean; data: HpRuleConfig[] }> => {
        // No list-all endpoint on backend; return empty for now
        return { success: true, data: [] };
    },

    // ── Students & Ledger (mock data) ────────────────────────

    getStudents: async (
        courseVersionId: string,
        cohort: string,
    ): Promise<{ success: boolean; data: HpStudent[] }> => {
        return apiFetch(`${BASE_URL}/courses-cohorts/version/${courseVersionId}/cohort/${cohort}/students`);
    },

    getCohortOverviewStats: async (
        _courseVersionId: string,
        _cohort: string,
    ): Promise<{ success: boolean; data: HpCohortOverviewStats }> => {
        // Mock data for the overview
        const mockStats: HpCohortOverviewStats = {
            totalStudents: 45,
            totalOverdue: 12,
            completionRates: [
                { activityId: 'a1', activityTitle: 'Build REST API', submittedCount: 40, pendingCount: 3, revertedCount: 2, totalAssigned: 45 },
                { activityId: 'a2', activityTitle: 'Week 1 Quiz', submittedCount: 45, pendingCount: 0, revertedCount: 0, totalAssigned: 45 },
                { activityId: 'a3', activityTitle: 'Database Schema Design', submittedCount: 28, pendingCount: 15, revertedCount: 2, totalAssigned: 45 },
                { activityId: 'a4', activityTitle: 'Deploy to Cloud', submittedCount: 15, pendingCount: 25, revertedCount: 5, totalAssigned: 45 },
                { activityId: 'a5', activityTitle: 'Midterm Project', submittedCount: 38, pendingCount: 5, revertedCount: 2, totalAssigned: 45 },
            ]
        };
        return { success: true, data: mockStats };
    },

    getStudentSubmissions: async (
        _studentId: string,
        _courseVersionId: string,
        _cohort: string,
    ): Promise<{ success: boolean; data: HpStudentSubmission[] }> => {
        const submissions: HpStudentSubmission[] = [
            {
                _id: 'sub1', activityId: 'a1', activityTitle: 'Build REST API', status: 'SUBMITTED',
                activityDescription: 'Design and build a RESTful API with Express.js. Must include CRUD operations, proper error handling, and middleware for authentication.',
                submissionLink: 'https://github.com/student/rest-api',
                attachments: [
                    { _id: 'att1', name: 'api-architecture.png', url: 'https://picsum.photos/seed/arch/800/600', type: 'image' },
                    { _id: 'att2', name: 'API-Documentation.pdf', url: 'https://example.com/docs/api-doc.pdf', type: 'pdf' },
                ],
                dueDate: '2025-11-22T23:59:00Z', submittedAt: '2025-11-20T14:30:00Z', lastUpdated: '2025-11-20T14:30:00Z',
                submissionCount: 1, isLate: false, baseHp: 100, currentHp: 100,
                instructorFeedback: 'Excellent REST API structure. Good use of middleware and error handling patterns.', safetyStatus: 'safe'
            },
            {
                _id: 'sub2', activityId: 'a2', activityTitle: 'Week 1 Quiz', status: 'SUBMITTED',
                activityDescription: 'Complete the quiz covering database fundamentals, normalization, and SQL queries.',
                attachments: [
                    { _id: 'att3', name: 'quiz-answers.pdf', url: 'https://example.com/docs/quiz.pdf', type: 'pdf' },
                ],
                dueDate: '2025-11-18T23:59:00Z', submittedAt: '2025-11-18T09:15:00Z', lastUpdated: '2025-11-18T09:15:00Z',
                submissionCount: 1, isLate: false, baseHp: 50, currentHp: 45,
                instructorFeedback: 'Good attempt. Review question 5 about normalization.', safetyStatus: 'safe'
            },
            {
                _id: 'sub3', activityId: 'a3', activityTitle: 'Database Schema Design', status: 'PENDING',
                activityDescription: 'Design a normalized database schema for an e-commerce platform. Include ER diagrams and SQL DDL scripts.',
                attachments: [],
                dueDate: '2025-12-05T23:59:00Z',
                submissionCount: 0, isLate: false, baseHp: 150, currentHp: 0
            },
            {
                _id: 'sub4', activityId: 'a4', activityTitle: 'Deploy to Cloud', status: 'REVERTED',
                activityDescription: 'Deploy your REST API to a cloud provider (AWS/GCP/Azure). Must include a health check endpoint and CI/CD pipeline.',
                submissionLink: 'https://github.com/student/cloud-deploy',
                attachments: [
                    { _id: 'att4', name: 'deployment-screenshot.png', url: 'https://picsum.photos/seed/deploy/800/600', type: 'image' },
                    { _id: 'att5', name: 'error-logs.pdf', url: 'https://example.com/docs/error-logs.pdf', type: 'pdf' },
                    { _id: 'att6', name: 'Live Demo', url: 'https://student-app.vercel.app', type: 'link' },
                ],
                dueDate: '2025-11-24T23:59:00Z', submittedAt: '2025-11-25T11:00:00Z', lastUpdated: '2025-11-26T10:00:00Z',
                submissionCount: 2, isLate: true, baseHp: 120, currentHp: 0,
                instructorFeedback: 'Deployment failed the health check endpoint. Resubmit once /health returns 200.', safetyStatus: 'unsafe'
            },
            {
                _id: 'sub5', activityId: 'a5', activityTitle: 'Midterm Project', status: 'SUBMITTED',
                activityDescription: 'Build a full-stack web application with authentication, database integration, and deployment. Include project report and demo video.',
                submissionLink: 'https://github.com/student/midterm',
                attachments: [
                    { _id: 'att7', name: 'project-report.pdf', url: 'https://example.com/docs/midterm-report.pdf', type: 'pdf' },
                    { _id: 'att8', name: 'demo-recording.mp4', url: 'https://example.com/videos/demo.mp4', type: 'other' },
                    { _id: 'att9', name: 'wireframes.png', url: 'https://picsum.photos/seed/wire/800/600', type: 'image' },
                ],
                dueDate: '2025-12-01T23:59:00Z', submittedAt: '2025-12-01T16:45:00Z', lastUpdated: '2025-12-01T16:45:00Z',
                submissionCount: 3, isLate: false, baseHp: 200, currentHp: 200, safetyStatus: 'safe'
            },
        ];
        return { success: true, data: submissions };
    },

    getStudentLedger: async (
        _studentId: string,
        _courseVersionId: string,
        _cohort: string,
    ): Promise<{ success: boolean; data: HpLedgerEntry[] }> => {
        const entries: HpLedgerEntry[] = [
            {
                _id: 'le1', studentId: _studentId, activityId: 'act1',
                activityTitle: 'Build REST API Project', status: 'SUBMITTED',
                submissionLink: 'https://github.com/student/rest-api-project',
                baseHp: 50, currentHp: 50, type: 'CREDIT',
                submittedAt: '2026-02-15T09:45:00Z', createdAt: '2026-02-15T10:30:00Z',
            },
            {
                _id: 'le2', studentId: _studentId, activityId: 'act2',
                activityTitle: 'Week 1 Quiz', status: 'SUBMITTED',
                submissionLink: 'https://platform.example.com/quiz/submission/123',
                baseHp: 40, currentHp: 30, type: 'CREDIT',
                instructorFeedback: 'Good attempt. Review question 5 about normalization.',
                submittedAt: '2026-02-18T13:50:00Z', createdAt: '2026-02-18T14:00:00Z',
            },
            {
                _id: 'le3', studentId: _studentId, activityId: 'act3',
                activityTitle: 'Deploy to Cloud', status: 'PENDING',
                baseHp: 60, currentHp: 0, type: 'CREDIT',
                createdAt: '2026-02-20T09:00:00Z',
            },
            {
                _id: 'le4', studentId: _studentId, activityId: 'act1',
                activityTitle: 'Late Submission Penalty', status: 'SUBMITTED',
                baseHp: 0, currentHp: -10, type: 'DEBIT',
                instructorFeedback: 'Late by 2 days',
                submittedAt: '2026-02-22T10:30:00Z', createdAt: '2026-02-22T11:00:00Z',
            },
            {
                _id: 'le5', studentId: _studentId, activityId: 'act4',
                activityTitle: 'Midterm Project', status: 'REVERTED',
                submissionLink: 'https://github.com/student/midterm',
                baseHp: 100, currentHp: 0, type: 'CREDIT',
                instructorFeedback: 'Reverted due to plagiarism concern',
                submittedAt: '2026-02-25T15:00:00Z', createdAt: '2026-02-25T16:30:00Z',
            },
        ];
        return { success: true, data: entries };
    },

    revertLedgerEntry: async (entryId: string): Promise<{ success: boolean }> => {
        console.log('Mock revert for entry:', entryId);
        return { success: true };
    },

    restoreLedgerEntry: async (entryId: string): Promise<{ success: boolean }> => {
        console.log('Mock restore for entry:', entryId);
        return { success: true };
    },
};
