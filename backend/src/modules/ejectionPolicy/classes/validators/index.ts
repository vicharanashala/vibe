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
} from './EjectionPolicyValidators.js';
import {
  ManualEjectionParams,
  ManualEjectionBody,
  ManualEjectionResponse,
} from './ManualEjectionValidators.js';

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
];

export * from './ManualEjectionValidators.js';
