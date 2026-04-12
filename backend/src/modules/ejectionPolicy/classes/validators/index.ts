import {
  CreateEjectionPolicyBody,
  UpdateEjectionPolicyBody,
  PolicyIdParams,
  CourseIdParams,
  GetPoliciesQuery,
  EjectionPolicyResponse,
  PoliciesListResponse,
  DeletePolicyResponse,
  InactivityTriggerDto,
  MissedDeadlinesTriggerDto,
  PolicyViolationsTriggerDto,
  CustomTriggerDto,
  PolicyTriggersDto,
  PolicyActionsDto,
  ViolationsDto,
  StudentEjectionHistoryEntry,
} from './EjectionPolicyValidators.js';
import {
  ManualEjectionParams,
  ManualEjectionBody,
  ManualEjectionResponse,
} from './ManualEjectionValidators.js';
import {
  EjectionHistoryQuery,
  EjectionHistoryResponse,
} from './EjectionHistoryValidators.js';

export * from './EjectionPolicyValidators.js';

export const EJECTION_POLICY_VALIDATORS = [
  CreateEjectionPolicyBody,
  UpdateEjectionPolicyBody,
  PolicyIdParams,
  CourseIdParams,
  GetPoliciesQuery,
  EjectionPolicyResponse,
  PoliciesListResponse,
  DeletePolicyResponse,
  InactivityTriggerDto,
  MissedDeadlinesTriggerDto,
  PolicyViolationsTriggerDto,
  CustomTriggerDto,
  PolicyTriggersDto,
  PolicyActionsDto,
  ViolationsDto,
  StudentEjectionHistoryEntry,
  EjectionHistoryQuery,
  EjectionHistoryResponse,
];

export * from './ManualEjectionValidators.js';
export * from './EjectionHistoryValidators.js';
