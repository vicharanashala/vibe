export enum PolicyScope {
  PLATFORM = 'platform',
  COURSE = 'course'
}

export interface InactivityTrigger {
  enabled: boolean;
  thresholdDays: number;
  warningDays: number;
}

export interface MissedDeadlinesTrigger {
  enabled: boolean;
  consecutiveMisses: number;
  warningAfterMisses: number;
}

export interface PolicyViolationsTrigger {
  enabled: boolean;
  violations: {
  predefined: string[]
  custom?: string[]
}
  thresholdCount: number;
}

export interface PolicyTriggers {
  inactivity?: InactivityTrigger | null;
  missedDeadlines?: MissedDeadlinesTrigger | null;
  policyViolations?: PolicyViolationsTrigger | null;
  anomalyDetection?: AnomalyDetectionTrigger;
  customTriggers?: any[] | null;
}

export interface AnomalyDetectionTrigger{
  enabled: boolean;
  thresholdScore: number;
  warningScore?: number;
}

export interface PolicyActions {
  sendWarning: boolean;
  warningTemplate?: string | null;
  ejectionTemplate?: string | null;
  allowAppeal: boolean;
  appealDeadlineDays?: number | null;
  autoReinstatementRules?: any | null;
}

export interface EjectionPolicy {
  _id: string;
  name: string;
  description?: string;
  scope: PolicyScope;
  courseId?: string | null;
  isActive: boolean;
  priority: number;
  triggers: PolicyTriggers;
  actions: PolicyActions;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}