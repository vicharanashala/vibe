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
    createdAt: string;
    updatedAt: string;
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

    // ── Activities (real backend) ────────────────────────────

    getActivities: async (
        courseVersionId: string,
        cohort: string,
        status?: string,
        _search?: string
    ): Promise<{ success: boolean; data: HpActivity[] }> => {
        // Return mock data for activities
        let activities: HpActivity[] = [
            {
                _id: 'act1',
                courseId: 'c1',
                courseVersionId: courseVersionId,
                cohort: cohort,
                createdByTeacherId: 't1',
                status: 'PUBLISHED',
                title: 'Build REST API Project',
                description: 'Create a Node.js REST API with authentication and deploy it. Submit the GitHub repository link.',
                activityType: 'ASSIGNMENT',
                submissionMode: 'IN_PLATFORM',
                externalLink: '',
                attachments: [
                    { name: 'Reference Guide', url: 'https://docs.example.com/rest-api-guide', kind: 'LINK' },
                ],
                stats: {
                    totalStudents: 120,
                    submittedCount: 85,
                    completedCount: 80,
                    overdueCount: 15,
                    lastRecomputedAt: new Date().toISOString()
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                _id: 'act2',
                courseId: 'c1',
                courseVersionId: courseVersionId,
                cohort: cohort,
                createdByTeacherId: 't1',
                status: 'DRAFT',
                title: 'Week 1 Quiz',
                description: 'Complete the multiple choice quiz covering week 1 topics.',
                activityType: 'ASSIGNMENT',
                submissionMode: 'IN_PLATFORM',
                externalLink: '',
                attachments: [],
                stats: {
                    totalStudents: 120,
                    submittedCount: 0,
                    completedCount: 0,
                    overdueCount: 0,
                    lastRecomputedAt: new Date().toISOString()
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        // Apply filters
        if (status && status !== 'ALL') {
            activities = activities.filter(a => a.status === status);
        }

        // Client-side search filtering
        if (_search) {
            const q = _search.toLowerCase();
            activities = activities.filter(a => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
        }

        return { success: true, data: activities };
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
};
