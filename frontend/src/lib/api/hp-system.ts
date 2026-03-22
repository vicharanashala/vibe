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

// ─── ID Resolution Workaround ────────────────────────────────
// Maps cohort name to the real database IDs used in the enrollment collection.
// This allows the frontend to resolve placeholder IDs ("000...1") before API calls.
export const COHORT_ID_MAP: Record<string, { courseId: string; versionId: string }> = {
    Euclideans: { courseId: "6968e12cbf2860d6e39051ae", versionId: "6968e12cbf2860d6e39051af" },
    Dijkstrians: { courseId: "6970f87e30644cbc74b6714f", versionId: "6970f87e30644cbc74b67150" },
    Kruskalians: { courseId: "697b4e262942654879011c56", versionId: "697b4e262942654879011c57" },
    RSAians: { courseId: "69903415e1930c015760a718", versionId: "69903415e1930c015760a719" },
    AKSians: { courseId: "69942dc6d6d99b252e3a54fe", versionId: "69942dc6d6d99b252e3a54ff" },
};

export function getEffectiveIds(cohortName: string, fallbackCourseId: string, fallbackVersionId: string) {
    const mapping = COHORT_ID_MAP[cohortName];
    return {
        courseId: mapping?.courseId ?? fallbackCourseId,
        courseVersionId: mapping?.versionId ?? fallbackVersionId,
    };
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
    // required_percentage?: number;
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
    required_percentage?: number;
    createdAt: string;
    updatedAt: string;
    isSubmitted?: boolean;
}

export interface HpStudent {
    _id: string;
    name: string;
    email: string;
    totalHp: number;
    completionPercentage: number;
    avatar?: string;
}

export interface HpLedgerCalcEntry {
    ruleType?: string;
    percentage?: number | null;
    absolutePoints?: number;
    baseHpAtTime?: number;
    computedAmount?: number;
    deadlineAt?: string;
    withinDeadline?: boolean;
    reasonCode?: string;
}

export interface HpLedgerMetaEntry {
    triggeredBy?: string;
    triggeredByUserId?: string;
    triggeredByUserName?: string | null;
    note?: string;
}

export interface HpLedgerLinksEntry {
    reversedLedgerId?: string;
    relatedLedgerIds?: string[];
}

export interface HpLedgerTransformerEntry {
    _id: string;
    courseId?: string;
    courseVersionId?: string;
    cohort?: string;
    studentId: string;
    studentEmail?: string;
    activityId?: string;
    submissionId?: string;
    eventType: string;
    direction: 'CREDIT' | 'DEBIT';
    amount: number;
    calc?: HpLedgerCalcEntry | null;
    links?: HpLedgerLinksEntry | null;
    meta?: HpLedgerMetaEntry | null;
    createdAt: string;
}

export interface LedgerStudentDetails {
    studentName: string;
    studentEmail: string;
    hpPoints: number;
}

export interface LedgerListResponse {
    data: HpLedgerTransformerEntry[];
    studentDetails: LedgerStudentDetails;
    total: number;
    page: number;
    limit: number;
}

export interface StudentDashboardStats {
    myStats: {
        totalHp: number;
        completedActivities: number;
        pendingSubmissions: number;
        completionPercentage: number;
    };
    progressTimeline: {
        date: string;
        hpChange: number;
        activitiesCompleted: number;
    }[];
    activityBreakdown: {
        notStarted: number;
        inProgress: number;
        submitted: number;
        approved: number;
    };
    upcomingDeadlines: {
        activityTitle: string;
        deadlineDate: string;
        daysLeft: number;
    }[];
    recentSubmissions: {
        activityTitle: string;
        submittedAt: string;
        status: string;
        hpEarned?: number;
    }[];
}

export interface HpCohortOverviewStats {
    totalStudents: number;
    totalOverdue: number;
    activeActivities: number;
    pendingReviews: number;
    completionRates: {
        activityId: string;
        activityTitle: string;
        submittedCount: number;
        pendingCount: number;
        revertedCount: number;
        totalAssigned: number;
    }[];
    submissionTimeline: {
        date: string;
        submitted: number;
        approved: number;
        rejected: number;
    }[];
    hpDistribution: {
        range: string;
        count: number;
        percentage: number;
    }[];
    studentProgress: {
        completed: number;
        inProgress: number;
        notStarted: number;
    }[];
    studentPerformance: {
        studentId: string;
        name: string;
        email: string;
        completedActivities: number;
        hpBalance: number;
        completionPercentage: number;
        lastActivityDate: string;
        status: 'on-track' | 'at-risk' | 'inactive';
    }[];
}

export interface SubmissionAttachment {
    _id: string;
    name: string;
    url: string;
    type: 'image' | 'pdf' | 'document' | 'link' | 'other';
    textResponse?: string;
    files?: Array<{ _id: string; name: string; url: string; type: string }>;
    images?: Array<{ _id: string; name: string; url: string; type: string }>;
    links?: Array<{ _id: string; name: string; url: string; type: string }>;
}

export interface InstructorFeedback {
    decision?: string;
    reviewerName?: string;
    reviewerEmail?: string;
    reviewedAt?: string;
    note?: string;
}

export interface HpStudentSubmission {
    _id: string;
    activityId: string;
    activityTitle: string;
    activityDescription?: string;
    status: 'SUBMITTED' | 'PENDING' | 'REVERTED' | 'APPROVED' | 'REJECTED';
    attachments: SubmissionAttachment[];
    submissionLink?: string;
    dueDate?: string;
    submittedAt?: string;
    lastUpdated?: string;
    submissionCount: number;
    isLate: boolean;
    baseHp: number;
    currentHp: number;
    instructorFeedback?: {
        decision: string;
        note: string;
        reviewedAt: string;
        reviewedBy: string;
    };
    feedbacks?: Array<{
        feedback: string;
        feedbackAt: string;
        username: string;
        email: string;
    }>;
    submission?: {
        _id: string;
        status: string;
        submittedAt: string;
        attachments?: {
            textResponse?: string;
            files?: Array<{ _id: string; name: string; url: string; type: string }>;
            images?: Array<{ _id: string; name: string; url: string; type: string }>;
            links?: Array<{ _id: string; name: string; url: string; type: string }>;
        };
    };
    safetyStatus?: 'safe' | 'unsafe';
    isRequiredInstructorApproval?: boolean;
}

export interface HpRuleConfig {
    _id: string;
    courseId: string;
    courseVersionId: string;
    activityId: string;
    isMandatory: boolean;
    deadlineAt?: string;
    allowLateSubmission?: boolean;
    reward?: {
        enabled: boolean;
        type: "ABSOLUTE" | "PERCENTAGE";
        value: number;
        applyWhen: "ON_SUBMISSION" | "ON_APPROVAL";
        lateBehavior: "NO_REWARD" | "REWARD";
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
        minHp?: number;
        maxHp?: number;
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
    attachments?: { name: string; url: string; kind: string }[];
    required_percentage?: number;
}

export interface HpStudentSubmissionStats {
    totalActivities: number;
    totalSubmissions: number;
    totalPendings: number;
    totalLateSubmissions: number;
    currentHp: number;
    reward?: {
        type: "ABSOLUTE" | "PERCENTAGE";
        value: number;
    } | null;
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

    getStudentCohorts: async (): Promise<{ success: boolean; message: string; data: any[]; totalHp?: number }> => {
        return apiFetch(`${BASE_URL}/courses-cohorts/student-cohorts`);
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

    updateActivitySubmission: async (submissionId: string, options: {
        courseId: string;
        courseVersionId: string;
        cohort: string;
        activityId: string;
        payload: {
            textResponse?: string;
            links?: { url: string; label: string }[];
            files?: any[];
            images?: any[];
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
            if (rest.payload.textResponse) {
                formData.append('payload[textResponse]', rest.payload.textResponse);
            }
            if (rest.payload.links) {
                rest.payload.links.forEach((link, idx) => {
                    formData.append(`payload[links][${idx}][url]`, link.url);
                    formData.append(`payload[links][${idx}][label]`, link.label);
                });
            }
            if (rest.payload.files) {
                rest.payload.files.forEach((file: any, idx: number) => {
                    if (file.fileId) formData.append(`payload[files][${idx}][fileId]`, file.fileId);
                    if (file.url) formData.append(`payload[files][${idx}][url]`, file.url);
                    if (file.name) formData.append(`payload[files][${idx}][name]`, file.name);
                    if (file.mimeType) formData.append(`payload[files][${idx}][mimeType]`, file.mimeType);
                    if (file.sizeBytes !== undefined) formData.append(`payload[files][${idx}][sizeBytes]`, String(file.sizeBytes));
                });
            }
            if (rest.payload.images) {
                rest.payload.images.forEach((img: any, idx: number) => {
                    if (img.fileId) formData.append(`payload[images][${idx}][fileId]`, img.fileId);
                    if (img.url) formData.append(`payload[images][${idx}][url]`, img.url);
                    if (img.name) formData.append(`payload[images][${idx}][name]`, img.name);
                });
            }

            if (files) {
                files.forEach(f => formData.append('files', f));
            }
            if (images) {
                images.forEach(img => formData.append('images', img));
            }

            const token = localStorage.getItem('firebase-auth-token');
            const res = await fetch(`${BASE_URL}/activity-submissions/${submissionId}`, {
                method: 'PUT',
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

        return apiFetch(`${BASE_URL}/activity-submissions/${submissionId}`, {
            method: 'PUT',
            body: JSON.stringify(rest),
        });
    },

    // ── Activities (real backend) ────────────────────────────

    getActivities: async (
        courseVersionId: string,
        cohort: string,
        status?: string,
        search?: string,
        activity?: string
    ): Promise<{ success: boolean; data: HpActivity[] }> => {
        const params = new URLSearchParams({ courseVersionId, cohort });
        if (status && status !== 'ALL') params.append('status', status);
        if (search) params.append('search', search);
        if (activity && activity !== 'ALL') params.append('activity', activity);
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
        return apiFetch(`${BASE_URL}/activities/${activityId}/delete`, {
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
        // Pass a large limit so we get all students for client-side pagination
        return apiFetch(`${BASE_URL}/courses-cohorts/version/${courseVersionId}/cohort/${cohort}/students?limit=1000&page=1`);
    },

    getCohortOverviewStats: async (
        _courseVersionId: string,
        _cohort: string,
    ): Promise<{ success: boolean; data: HpCohortOverviewStats }> => {
        // Enhanced mock data for the overview
        const mockStats: HpCohortOverviewStats = {
            totalStudents: 45,
            totalOverdue: 12,
            activeActivities: 12,
            pendingReviews: 8,
            completionRates: [
                { activityId: 'a1', activityTitle: 'Build REST API', submittedCount: 40, pendingCount: 3, revertedCount: 2, totalAssigned: 45 },
                { activityId: 'a2', activityTitle: 'Week 1 Quiz', submittedCount: 45, pendingCount: 0, revertedCount: 0, totalAssigned: 45 },
                { activityId: 'a3', activityTitle: 'Database Schema Design', submittedCount: 28, pendingCount: 15, revertedCount: 2, totalAssigned: 45 },
                { activityId: 'a4', activityTitle: 'Deploy to Cloud', submittedCount: 15, pendingCount: 25, revertedCount: 5, totalAssigned: 45 },
                { activityId: 'a5', activityTitle: 'Midterm Project', submittedCount: 38, pendingCount: 5, revertedCount: 2, totalAssigned: 45 },
            ],
            submissionTimeline: [
                { date: '2024-01-01', submitted: 5, approved: 3, rejected: 0 },
                { date: '2024-01-02', submitted: 8, approved: 6, rejected: 1 },
                { date: '2024-01-03', submitted: 12, approved: 8, rejected: 2 },
                { date: '2024-01-04', submitted: 6, approved: 4, rejected: 0 },
                { date: '2024-01-05', submitted: 15, approved: 10, rejected: 3 },
                { date: '2024-01-06', submitted: 9, approved: 7, rejected: 1 },
                { date: '2024-01-07', submitted: 18, approved: 12, rejected: 4 },
            ],
            hpDistribution: [
                { range: '0-50 HP', count: 5, percentage: 11.1 },
                { range: '51-100 HP', count: 12, percentage: 26.7 },
                { range: '101-200 HP', count: 18, percentage: 40.0 },
                { range: '201-300 HP', count: 7, percentage: 15.6 },
                { range: '300+ HP', count: 3, percentage: 6.7 },
            ],
            studentProgress: [
                { completed: 15, inProgress: 20, notStarted: 10 },
            ],
            studentPerformance: [
                { studentId: 's1', name: 'Alice Johnson', email: 'alice@example.com', completedActivities: 8, hpBalance: 250, completionPercentage: 89, lastActivityDate: '2024-01-07', status: 'on-track' },
                { studentId: 's2', name: 'Bob Smith', email: 'bob@example.com', completedActivities: 6, hpBalance: 180, completionPercentage: 67, lastActivityDate: '2024-01-06', status: 'on-track' },
                { studentId: 's3', name: 'Charlie Brown', email: 'charlie@example.com', completedActivities: 3, hpBalance: 75, completionPercentage: 33, lastActivityDate: '2024-01-03', status: 'at-risk' },
                { studentId: 's4', name: 'Diana Prince', email: 'diana@example.com', completedActivities: 9, hpBalance: 320, completionPercentage: 100, lastActivityDate: '2024-01-07', status: 'on-track' },
                { studentId: 's5', name: 'Edward Norton', email: 'edward@example.com', completedActivities: 2, hpBalance: 45, completionPercentage: 22, lastActivityDate: '2023-12-28', status: 'inactive' },
                { studentId: 's6', name: 'Fiona Green', email: 'fiona@example.com', completedActivities: 7, hpBalance: 210, completionPercentage: 78, lastActivityDate: '2024-01-05', status: 'on-track' },
                { studentId: 's7', name: 'George Miller', email: 'george@example.com', completedActivities: 4, hpBalance: 120, completionPercentage: 44, lastActivityDate: '2024-01-04', status: 'at-risk' },
                { studentId: 's8', name: 'Hannah Davis', email: 'hannah@example.com', completedActivities: 8, hpBalance: 275, completionPercentage: 89, lastActivityDate: '2024-01-07', status: 'on-track' },
            ]
        };
        return { success: true, data: mockStats };
    },

    getStudentDashboardStats: async (
        _courseVersionId: string,
        _cohortName: string,
    ): Promise<{ success: boolean; data: StudentDashboardStats }> => {
        // Mock data for student dashboard
        const mockStats: StudentDashboardStats = {
            myStats: {
                totalHp: 275,
                completedActivities: 8,
                pendingSubmissions: 3,
                completionPercentage: 89,
            },
            progressTimeline: [
                { date: '2024-01-01', hpChange: 25, activitiesCompleted: 2 },
                { date: '2024-01-02', hpChange: -5, activitiesCompleted: 1 },
                { date: '2024-01-03', hpChange: 30, activitiesCompleted: 1 },
                { date: '2024-01-04', hpChange: 15, activitiesCompleted: 0 },
                { date: '2024-01-05', hpChange: 40, activitiesCompleted: 2 },
                { date: '2024-01-06', hpChange: -10, activitiesCompleted: 1 },
                { date: '2024-01-07', hpChange: 35, activitiesCompleted: 1 },
            ],
            activityBreakdown: {
                notStarted: 2,
                inProgress: 3,
                submitted: 3,
                approved: 8,
            },
            upcomingDeadlines: [
                { activityTitle: 'Database Schema Design', deadlineDate: '2024-01-15', daysLeft: 3 },
                { activityTitle: 'Deploy to Cloud', deadlineDate: '2024-01-18', daysLeft: 6 },
                { activityTitle: 'Midterm Project', deadlineDate: '2024-01-22', daysLeft: 10 },
            ],
            recentSubmissions: [
                { activityTitle: 'Build REST API', submittedAt: '2024-01-07', status: 'approved', hpEarned: 25 },
                { activityTitle: 'Week 1 Quiz', submittedAt: '2024-01-06', status: 'approved', hpEarned: 15 },
                { activityTitle: 'Database Design', submittedAt: '2024-01-05', status: 'pending', hpEarned: 0 },
                { activityTitle: 'API Documentation', submittedAt: '2024-01-04', status: 'rejected', hpEarned: -5 },
            ]
        };
        return { success: true, data: mockStats };
    },

    getStudentSubmissionStats: async (
        studentId: string,
        cohortName: string,
    ): Promise<{ success: boolean; data: HpStudentSubmissionStats | null }> => {
        return apiFetch(
            `${BASE_URL}/activity-submissions/stats/student/${studentId}/cohort/${encodeURIComponent(cohortName)}`
        );
    },

    getStudentSubmissions: async (
        studentId: string,
        courseVersionId: string,
        cohort: string,
        sortOrder: 'asc' | 'desc' = 'desc',
    ): Promise<{ success: boolean; data: any[] }> => {
        const params = new URLSearchParams({ courseVersionId, cohort, sortOrder });
        // The backend returns { success, data: StudentActivitySubmissionsViewDto[] }
        return apiFetch(`${BASE_URL}/activity-submissions/student/${studentId}/cohort/${cohort}?${params.toString()}`);
    },


    // TODO: Do not remove this function, later we will use it
    // getStudentSubmissionStats: async(
    //     studentId: string,
    //     cohort: string,
    // ): Promise<{ success: boolean; data: any }> => {
    //     return apiFetch(`${BASE_URL}/activity-submissions/stats/student/${studentId}/cohort/${cohort}`);
    // },

    // Made by Rishabh Shukla
    getCohortActivityStats: async (cohortName: string, activityId: string): Promise<{ data: any }> => {
        return apiFetch(`${BASE_URL}/activity-submissions/stats/cohort/${cohortName}/activity/${activityId}`);
    },

    // Made by Rishabh Shukla
    getCohortActivityStatsMap: async (cohortName: string, courseVersionId: string): Promise<{ success: boolean; data: any }> => {
        return apiFetch(`${BASE_URL}/activity-submissions/stats/cohort/${cohortName}/courseVersion/${courseVersionId}`);
    },

    getStudentLedger: async (
        studentId: string,
        cohortName: string,
        courseId: string,
        courseVersionId: string,
        page: number = 1,
        limit: number = 50,
    ): Promise<LedgerListResponse> => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        return apiFetch(
            `${BASE_URL}/ledger/student/${studentId}/cohort/${encodeURIComponent(cohortName)}/course/${courseId}/courseVersion/${courseVersionId}?${params.toString()}`
        );
    },

    getMyLedger: async (
        courseId: string,
        courseVersionId: string,
        cohort: string,
        page: number = 1,
        limit: number = 50,
    ): Promise<LedgerListResponse> => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        return apiFetch(
            `${BASE_URL}/ledger/student/my-ledger/course/${courseId}/courseVersion/${courseVersionId}/cohort/${encodeURIComponent(cohort)}?${params.toString()}`
        );
    },

    revertLedgerEntry: async (entryId: string): Promise<{ success: boolean }> => {
        console.log('Mock revert for entry:', entryId);
        return { success: true };
    },

    restoreLedgerEntry: async (entryId: string): Promise<{ success: boolean }> => {
        console.log('Mock restore for entry:', entryId);
        return { success: true };
    },

    reviewSubmission: async (submissionId: string, decision: "APPROVED" | "REJECTED" | "REVERTED", note?: string, pointsToDeduct?: number): Promise<{ success: boolean; data: any }> => {
        return apiFetch(`${BASE_URL}/activity-submissions/${submissionId}/review`, {
            method: 'POST',
            body: JSON.stringify({ decision, note, pointsToDeduct }),
        });
    },
    addFeedback: async (submissionId: string, feedback: string): Promise<{ success: boolean; data: any }> => {
        return apiFetch(`${BASE_URL}/activity-submissions/${submissionId}/feedback`, {
            method: 'POST',
            body: JSON.stringify({ feedback }),
        });
    },
};
