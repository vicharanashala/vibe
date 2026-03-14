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
