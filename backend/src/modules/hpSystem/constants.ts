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
  AUTO_REWARD = 'AUTO_REWARD',
  AUTO_PENALTY = 'AUTO_PENALTY',
  RESTORE= 'RESTORE'
}

export enum HpLedgerDirection {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum HpReasonCode {
  SUBMISSION_REWARD = 'SUBMISSION_REWARD',
  MILESTONE_REWARD = 'MILESTONE_REWARD',
  MISSED_DEADLINE_PENALTY = 'MISSED_DEADLINE_PENALTY',
  REWARD_REVERSAL = 'REWARD_REVERSAL',
  BASE_INIT = 'BASE_INIT',
  MANUAL = 'MANUAL',
}

export enum TriggeredBy {
  SYSTEM = 'SYSTEM',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  SYSTEM_AUTOMATION = 'SYSTEM_AUTOMATION',
}


/**
 * @deprecated Use CohortRepository.resolveCohort() instead. 
 * Hardcoded IDs differ across environments and should not be relied upon in logic.
 * Keeping for backward compatibility fallback only.
 */
export interface CohortOverride {
  courseId: string;
  versionId: string;
  /** Populated at runtime by querying the cohorts collection */
  cohortId?: string;
}

/**
 * @deprecated These mappings are now stored in the 'cohorts' collection.
 * Logic should resolve these dynamically using resolveCohort(cohortName).
 */
export const COHORT_OVERRIDES: Record<string, CohortOverride> = {
  Euclideans: { courseId: "6968e12cbf2860d6e39051ae", versionId: "6968e12cbf2860d6e39051af", cohortId: "69d31909b50379d839ff3492" },
  Dijkstrians: { courseId: "6970f87e30644cbc74b6714f", versionId: "6970f87e30644cbc74b67150", cohortId: "69d3190ab50379d839ff3493" },
  Kruskalians: { courseId: "697b4e262942654879011c56", versionId: "697b4e262942654879011c57", cohortId: "69d3190ab50379d839ff3494" },
  RSAians: { courseId: "69903415e1930c015760a718", versionId: "69903415e1930c015760a719", cohortId: "69d3190ab50379d839ff3495" },
  AKSians: { courseId: "69942dc6d6d99b252e3a54fe", versionId: "69942dc6d6d99b252e3a54ff", cohortId: "69d3190ab50379d839ff3496" },
  A: { courseId: "69d2b1bc0744872b91ab54d9", versionId: "69d2b1bc0744872b91ab54da", cohortId: "69d31a4697aaee1324e583d5" },
  B: { courseId: "69d2b2e50744872b91ab641e", versionId: "69d2b2e50744872b91ab641f", cohortId: "69d31a4697aaee1324e583d6" },
  Scorchers: { courseId: "69c77763b4ae917c56cf1342", versionId: "69c77763b4ae917c56cf1343", cohortId: "69d3190ab50379d839ff3498" },
  Testians: { courseId: "69c77812b4ae917c56cf227e", versionId: "69c77812b4ae917c56cf227f", cohortId: "69d3190ab50379d839ff3497" },
};

/**
 * @deprecated Legacy course:version pseudo-IDs. 
 * Managed via the isLegacy flag in the cohorts collection now.
 */
export const LEGACY_COURSE_KEYS = new Set([
  "000000000000000000000001:000000000000000000000001",
  "000000000000000000000002:000000000000000000000002",
]);