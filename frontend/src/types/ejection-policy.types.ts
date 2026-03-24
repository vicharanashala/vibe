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

  courseId?: string | null;
  courseVersionId?: string | null;
  cohortId?: string | null;
  
  isActive: boolean;
  triggers: PolicyTriggers;
  actions: PolicyActions;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
// Add these new types:
export interface EjectionHistoryEntry {
  ejectedAt: string;
  ejectionReason: string;
  ejectedBy: string;
  ejectedByName?: string;
  policyId?: string;
  reinstatedAt?: string;
  reinstatedBy?: string;
}

export interface EjectionStudent {
  enrollmentId: string;
  userId: string;
  name: string;
  email: string;
  enrollmentDate: string;
  percentCompleted: number;
  lastActiveAt?: string;
  daysSinceLastActive?: number;
  isEjected: boolean;
  ejectionStatus: 'active' | 'warning' | 'ejected';
  ejectionHistory?: EjectionHistoryEntry[];
}

export interface EjectionStudentsResponse {
  students: EjectionStudent[];
  totalDocuments: number;
  totalPages: number;
  currentPage: number;
}

export interface ReinstatementResponse {
  message: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  courseVersionId: string;
  reinstatedAt: string;
}