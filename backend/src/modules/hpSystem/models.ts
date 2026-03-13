


// hp_activities

import { ID } from "./constants.js";

export type ActivityStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type ActivityType =
    | "ASSIGNMENT"
    | "MILESTONE"
    | "EXTERNAL_IMPORT"
    | "VIBE_MILESTONE"
    | "OTHER";

export type SubmissionMode = "IN_PLATFORM" | "EXTERNAL_LINK";

export type LateRewardPolicy =
    | "NONE"
    | "REWARD_ALLOWED"
    | "REWARD_DENIED";

export type AttachmentKind = "PDF" | "LINK" | "OTHER";

export interface HpActivity {
    _id: ID;

    // Scoping
    courseVersionId: ID;
    courseId: ID;
    cohort: string;

    // Authoring
    createdByTeacherId: ID;
    publishedByTeacherId: ID;
    status: ActivityStatus;

    // Content
    title: string;
    description: string;
    activityType: ActivityType;

    // Submission mode
    submissionMode: SubmissionMode; // if EXTERNAL_LINK, students will submit by providing a link to an external platform (e.g. google form, github repo, etc.)
    externalLink: string;
    attachments: {
        name: string;
        url: string;
        kind: AttachmentKind;
    }[];

    // Stats
    stats: { // to track submission stats for this activity, updated by a scheduled job that runs every hour
        totalStudents: number;
        submittedCount: number;
        completedCount: number;
        overdueCount: number;
        lastRecomputedAt: Date;
    };

    createdAt: Date;
    updatedAt: Date;
}



// hp_activity_submissions

export type SubmissionStatus =
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "REVERTED";

export type SubmissionSource =
    | "IN_PLATFORM"
    | "CSV_IMPORT"
    | "GOOGLE_FORM"
    | "VIBE_AUTO";

export type ReviewDecision = "APPROVED" | "REJECTED" | "REVERTED";




export interface HpActivitySubmission {
    _id?: ID;

    courseId: ID;
    courseVersionId: ID;
    cohort: string;
    activityId: ID;

    // Identity
    studentId: ID;
    studentEmail: string;
    studentName: string;

    // Submission content
    status: SubmissionStatus;
    submittedAt: Date;

    payload: {
        textResponse: string;
        links: {
            url: string;
            label: string;
        }[];
        files: {
            fileId: ID;
            url: string;
            name: string;
            mimeType: string;
            sizeBytes: number;
        }[];
        images: {
            fileId: ID;
            url: string;
            name: string;
        }[];
    };

    // Teacher review / revert
    review: { // populated when status is APPROVED, REJECTED or REVERTED
        reviewedByTeacherId: ID;
        reviewedAt: Date;
        decision: ReviewDecision;
        note: string;
    } | null;

    // Ledger linkage
    ledgerRefs: {
        rewardLedgerId: ID; // reference to the ledger entry that rewards the student for this submission, populated when status is APPROVED
        revertLedgerIds: ID[]; // reference to the ledger entries that revert the reward for this submission, populated when status is REVERTED
        penaltyLedgerId: ID; // reference to the ledger entry that penalizes the student for late submission, populated when status is APPROVED and submission is late and lateRewardPolicy is REWARD_ALLOWED
    } | null;

    feedbacks: {
        teacherId: ID,
        feedbackAt: Date;
        feedback: string
    }[];

    // Flags
    isLate: boolean; // populated when status is SUBMITTED, indicates whether the submission was submitted after the deadline
    submissionSource: SubmissionSource;

    createdAt: Date;
    updatedAt: Date;
}


// hp_rule_configs


export type RuleType = "ABSOLUTE" | "PERCENTAGE";

export type RewardApplyWhen = "ON_SUBMISSION" | "ON_APPROVAL";

export type LateBehavior = "NO_REWARD" | "REWARD";

export type PenaltyApplyWhen = "AFTER_DEADLINE";

export interface HpRuleConfig {
    _id: ID;

    courseId: ID;
    courseVersionId: ID;
    activityId: ID;

    // Mandatory/Optional
    isMandatory: boolean;
    // vibe_percent: 25%,

    deadlineAt: Date;
    allowLateSubmission: boolean;
    lateRewardPolicy: LateRewardPolicy;

    // Reward rule
    reward: {
        enabled: boolean;
        type: RuleType;
        value: number;
        applyWhen: RewardApplyWhen;
        onlyWithinDeadline: boolean;
        allowLate: boolean;
        lateBehavior: LateBehavior;
        minHpFloor: number;
    };
    
    // students => hpPOints = 50 (shouldn't be -ve)

    // penalty type = % => 10 => 10% of 50 => 5 => 50 -5 

    // penalty type = absolute => 10 => 50 - 10 => 40

    // Penalty rule
    penalty: {
        enabled: boolean;
        type: RuleType;
        value: number;
        applyWhen: PenaltyApplyWhen;
        graceMinutes: number;
        // runOnce: boolean;
    };

    // Safety guards
    limits: {
        minHp: number;
        maxHp: number;
    };

    createdAt: Date;
    updatedAt: Date;
}


// hp_ledger


export type HpLedgerEventType =
    | "BASE_INIT"
    | "CREDIT"
    | "DEBIT"
    | "REVERSAL"
    | "MANUAL_ADJUST"
    | "MILESTONE"
    | "REJECTION";

export type HpLedgerDirection = "CREDIT" | "DEBIT";

export type HpReasonCode =
    | "SUBMISSION_REWARD"
    | "MISSED_DEADLINE_PENALTY"
    | "REWARD_REVERSAL"
    | "REJECTION_PENALTY"
    | "BASE_INIT"
    | "MANUAL";

export type TriggeredBy = "SYSTEM" | "TEACHER" | "STUDENT" | "JOB";

export interface HpLedger {
    _id?: ID;

    courseId: ID;
    courseVersionId: ID;
    cohort: String;

    // Identity
    studentId: ID;
    studentEmail: string;

    // Context references
    activityId: ID;
    submissionId: ID;

    // Event
    eventType: HpLedgerEventType;
    direction: HpLedgerDirection;
    amount: number;

    // Calculation snapshot
    calc: {
        ruleType: RuleType;
        percentage?: number;
        absolutePoints?: number;
        baseHpAtTime: number;
        computedAmount: number;
        deadlineAt: Date;
        withinDeadline: boolean;
        reasonCode: HpReasonCode;
    };

    // Reversal links
    links: {
        reversedLedgerId: ID;
        relatedLedgerIds: ID[];
    } | null;

    meta: {
        triggeredBy: TriggeredBy;
        triggeredByUserId: ID;
        note: string;
    };

    createdAt: Date;
}