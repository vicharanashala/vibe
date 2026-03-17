export const EJECTION_POLICY_TYPES = {
  // Services
  EjectionPolicyService: Symbol.for('EjectionPolicyService'),

  // Repositories
  EjectionPolicyRepo: Symbol.for('EjectionPolicyRepo'),
};

export type TriggerType =
  | 'inactivity'
  | 'missed-deadlines'
  | 'violation'
  | 'anomaly-detection'
  | 'custom';
export type PolicyScope = 'platform' | 'course';
export type PolicyStatus = 'active' | 'inactive' | 'archived';

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
    predefined: string[];
    custom?: string[];
  };
  thresholdCount: number;
}

export interface CustomTrigger {
  type: string;
  condition: Record<string, any>;
  threshold: number;
}

export interface PolicyTriggers {
  inactivity?: InactivityTrigger;
  missedDeadlines?: MissedDeadlinesTrigger;
  policyViolations?: PolicyViolationsTrigger;
  customTriggers?: CustomTrigger[];
  anomalyDetection?: AnomalyDetectionTrigger;
}

export interface AnomalyDetectionTrigger {
  enabled: boolean;
  thresholdScore: number;
  warningScore?: number;
}

export interface PolicyActions {
  sendWarning: boolean;
  warningTemplate?: string;
  ejectionTemplate?: string;
  allowAppeal: boolean;
  appealDeadlineDays?: number;
  autoReinstatementRules?: Record<string, any>;
}
