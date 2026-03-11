import { ObjectId } from "mongodb";

export type ID = string | ObjectId | null;


export enum SubmissionStatus {
  NOT_STARTED = 'NOT_STARTED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVERTED = 'REVERTED',
}

export enum SubmissionSource {
  IN_PLATFORM = 'IN_PLATFORM',
  CSV_IMPORT = 'CSV_IMPORT',
  GOOGLE_FORM = 'GOOGLE_FORM',
  VIBE_AUTO = 'VIBE_AUTO',
}

export enum ReviewDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVERTED = 'REVERTED',
}

export enum ActivityStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum ActivityType {
  ASSIGNMENT = 'ASSIGNMENT',
  MILESTONE = 'MILESTONE',
  EXTERNAL_IMPORT = 'EXTERNAL_IMPORT',
  VIBE_MILESTONE = 'VIBE_MILESTONE',
  OTHER = 'OTHER',
}

export enum SubmissionMode {
  IN_PLATFORM = 'IN_PLATFORM',
  EXTERNAL_LINK = 'EXTERNAL_LINK',
}

export enum LateRewardPolicy {
  NONE = 'NONE',
  REWARD_ALLOWED = 'REWARD_ALLOWED',
  REWARD_DENIED = 'REWARD_DENIED',
}

export enum AttachmentKind {
  PDF = 'PDF',
  LINK = 'LINK',
  OTHER = 'OTHER',
}

export enum RuleType {
  ABSOLUTE = 'ABSOLUTE',
  PERCENTAGE = 'PERCENTAGE',
}

export enum RewardApplyWhen {
  ON_SUBMISSION = 'ON_SUBMISSION',
  ON_APPROVAL = 'ON_APPROVAL',
}

export enum LateBehavior {
  NO_REWARD = 'NO_REWARD',
  REWARD = 'REWARD',
}

export enum PenaltyApplyWhen {
  AFTER_DEADLINE = 'AFTER_DEADLINE',
}

export enum HpRuleStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum HpLedgerEventType {
  BASE_INIT = 'BASE_INIT',
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  REVERSAL = 'REVERSAL',
  MANUAL_ADJUST = 'MANUAL_ADJUST',
  MILESTONE = 'MILESTONE',
}

export enum HpLedgerDirection {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum HpReasonCode {
  SUBMISSION_REWARD = 'SUBMISSION_REWARD',
  MISSED_DEADLINE_PENALTY = 'MISSED_DEADLINE_PENALTY',
  REWARD_REVERSAL = 'REWARD_REVERSAL',
  BASE_INIT = 'BASE_INIT',
  MANUAL = 'MANUAL',
}

export enum TriggeredBy {
  SYSTEM = 'SYSTEM',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  JOB = 'JOB',
}
