import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {BadRequestError, NotFoundError} from 'routing-controllers';
import {EjectionPolicyRepository} from '../repositories/providers/mongodb/EjectionPolicyRepository.js';
import {EjectionPolicy} from '../classes/transformers/EjectionPolicy.js';
import {EJECTION_POLICY_TYPES} from '../types.js';
import {BaseService} from '#shared/classes/BaseService.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';

@injectable()
export class EjectionPolicyService extends BaseService {
  constructor(
    @inject(EJECTION_POLICY_TYPES.EjectionPolicyRepo)
    private readonly policyRepo: EjectionPolicyRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  /**
   * Create a new ejection policy
   * Validates business rules before creation
   */
  async createPolicy(
    policyData: Partial<EjectionPolicy>,
    createdBy: string,
  ): Promise<EjectionPolicy> {
    return this._withTransaction(async session => {
      // Validate policy data
      this.validatePolicyData(policyData);

      if (policyData.cohortId) {
        const existing = await this.policyRepo.findByCohort(
          String(policyData.courseId),
          String(policyData.courseVersionId),
          String(policyData.cohortId),
          undefined,
          session,
        );
        if (existing) {
          throw new BadRequestError(
            'A policy already exists for this cohort. Only one policy per cohort is allowed.',
          );
        }
      }

      // Check for conflicts
      // await this.checkPolicyConflicts(policyData, undefined, session);

      // Create the policy
      const policy = new EjectionPolicy({
        ...policyData,
        createdBy,
      });

      try {
        const policyId = await this.policyRepo.create(policy, session);
        const createdPolicy = await this.policyRepo.findById(policyId, session);

        if (!createdPolicy) {
          throw new Error('Failed to create policy');
        }

        return createdPolicy;
      } catch (err: any) {
        if (err.code === 11000) {
          throw new BadRequestError(
            'A policy already exists for this cohort. Only one policy per cohort is allowed.',
          );
        }
        throw err;
      }
    });
  }

  /**
   * Get policy by ID
   */
  /**
   * Get policy by ID
   */
  async getPolicyById(
    policyId: string,
    includeDeleted: boolean = false,
  ): Promise<EjectionPolicy> {
    const policy = await this.policyRepo.findById(policyId);

    if (!policy) {
      // Check if policy exists but is deleted
      const deletedPolicy = await this.policyRepo.findDeletedById(policyId);

      if (deletedPolicy) {
        throw new NotFoundError(
          'This policy has been deleted and is no longer accessible',
        );
      }

      throw new NotFoundError('Policy not found');
    }

    return policy;
  }
  /**
   * Get all policies with optional filters
   */
  async getPolicies(filters: {
    courseId?: string;
    courseVersionId?: string;
    cohortId?: string;
    isActive?: boolean;
  }): Promise<EjectionPolicy[]> {
    return await this.policyRepo.find(filters);
  }

  /**
   * Get active policies for a specific course
   * Returns both platform-wide and course-specific policies
   */
  async getActivePoliciesForCourse(
    courseId: string,
    courseVersionId: string,
    cohortId: string,
  ): Promise<EjectionPolicy[]> {
    return await this.policyRepo.findActivePoliciesForCourse(
      courseId,
      courseVersionId,
      cohortId,
    );
  }

  /**
   * Update an existing policy
   */
  /**
   * Update an existing policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<EjectionPolicy>,
  ): Promise<EjectionPolicy> {
    return this._withTransaction(async session => {
      // Check if policy exists
      const existingPolicy = await this.policyRepo.findById(policyId, session);

      if (!existingPolicy) {
        // Check if deleted
        const deletedPolicy = await this.policyRepo.findDeletedById(
          policyId,
          session,
        );

        if (deletedPolicy) {
          throw new BadRequestError('Cannot update a deleted policy');
        }

        throw new NotFoundError('Policy not found');
      }

      // Validate updates
      if (updates.triggers || updates.actions) {
        this.validatePolicyData({...existingPolicy, ...updates});
      }

      // Update the policy
      const updatedPolicy = await this.policyRepo.update(
        policyId,
        updates,
        session,
      );

      if (!updatedPolicy) {
        throw new Error('Failed to update policy');
      }

      return updatedPolicy;
    });
  }

  /**
   * Delete (soft delete) a policy
   */
  /**
   * Delete (soft delete) a policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    // First check if the policy exists (even if deleted)
    const policy = await this.policyRepo.findByIdIncludingDeleted(policyId);

    if (!policy) {
      throw new NotFoundError('Policy not found');
    }

    if (policy.isDeleted) {
      throw new BadRequestError('This policy has already been deleted');
    }

    const deleted = await this.policyRepo.delete(policyId);

    if (!deleted) {
      throw new Error('Failed to delete policy');
    }
  }

  /**
   * Toggle policy active status
   */
  async togglePolicyStatus(policyId: string): Promise<EjectionPolicy> {
    const policy = await this.getPolicyById(policyId);

    return await this.updatePolicy(policyId, {
      isActive: !policy.isActive,
    });
  }

  // ============= VALIDATION METHODS =============

  /**
   * Validate policy data before creating/updating
   */
  private validatePolicyData(policy: Partial<EjectionPolicy>): void {
    // Validate triggers
    console.log('policy;;;;;;;;;;;;;;;;;;;;;;;:', policy);

    if (!policy.triggers) {
      throw new BadRequestError(
        'Policy must have at least one trigger configured',
      );
    }

    const triggers = policy.triggers;
    const hasEnabledTrigger =
      // triggers.inactivity?.enabled ||
      triggers.missedDeadlines?.enabled ||
      triggers.policyViolations?.enabled ||
      triggers.anomalyDetection?.enabled ||
      (triggers.customTriggers && triggers.customTriggers.length > 0);

    if (!hasEnabledTrigger) {
      throw new BadRequestError(
        'Policy must have at least one enabled trigger',
      );
    }

    // Validate inactivity trigger
    // if (triggers.inactivity?.enabled) {
    //   this.validateInactivityTrigger(triggers.inactivity);
    // }

    // Validate missed deadlines trigger
    if (triggers.missedDeadlines?.enabled) {
      this.validateMissedDeadlinesTrigger(triggers.missedDeadlines);
    }

    // Validate policy violations trigger
    if (triggers.policyViolations?.enabled) {
      this.validatePolicyViolationsTrigger(triggers.policyViolations);
    }
    // Validate anomaly detection trigger
    if (triggers.anomalyDetection?.enabled) {
      this.validateAnomalyTrigger(triggers.anomalyDetection);
    }

    // Validate actions
    if (policy.actions) {
      this.validateActions(policy.actions);
    }

    if (!policy.courseId) {
      throw new BadRequestError('courseId is required');
    }
    if (!policy.courseVersionId) {
      throw new BadRequestError('courseVersionId is required');
    }
    if (!policy.cohortId) {
      throw new BadRequestError('cohortId is REQUIRED');
    }
  }
  /*
   * Validate Anomaly trigger
   */
  private validateAnomalyTrigger(trigger: any): void {
    if (trigger.thresholdScore <= 0) {
      throw new BadRequestError(
        'Anomaly detection threshold score must be greater than 0',
      );
    }

    if (
      trigger.warningScore !== undefined &&
      trigger.warningScore >= trigger.thresholdScore
    ) {
      throw new BadRequestError(
        'Warning score must be less than threshold score',
      );
    }
  }

  /**
   * Validate inactivity trigger
   */
  // private validateInactivityTrigger(trigger: any): void {
  //   if (trigger.thresholdDays <= 0) {
  //     throw new BadRequestError(
  //       'Inactivity threshold must be greater than 0 days',
  //     );
  //   }

  //   if (trigger.warningDays < 0) {
  //     throw new BadRequestError('Warning days cannot be negative');
  //   }

  //   if (trigger.warningDays >= trigger.thresholdDays) {
  //     throw new BadRequestError(
  //       'Warning days must be less than threshold days',
  //     );
  //   }
  // }

  /**
   * Validate missed deadlines trigger
   */
  private validateMissedDeadlinesTrigger(trigger: any): void {
    if (trigger.consecutiveMisses <= 0) {
      throw new BadRequestError('Consecutive misses must be greater than 0');
    }

    if (trigger.warningAfterMisses < 0) {
      throw new BadRequestError('Warning after misses cannot be negative');
    }

    if (trigger.warningAfterMisses >= trigger.consecutiveMisses) {
      throw new BadRequestError(
        'Warning threshold must be less than ejection threshold',
      );
    }

    if (trigger.progressRules && Array.isArray(trigger.progressRules)) {
      for (const rule of trigger.progressRules) {
        if (rule.timeframeDays <= 0) {
          throw new BadRequestError('Timeframe days must be greater than 0');
        }
        if (rule.targetPercentage < 0 || rule.targetPercentage > 100) {
          throw new BadRequestError(
            'Target percentage must be between 0 and 100',
          );
        }
      }
    }
  }

  /**
   * Validate policy violations trigger
   */
  private validatePolicyViolationsTrigger(trigger: any): void {
    const predefined = trigger.violations?.predefined || [];
    const custom = trigger.violations?.custom || [];

    if (predefined.length === 0 && custom.length === 0) {
      throw new BadRequestError('At least one violation must be specified');
    }

    if (trigger.thresholdCount <= 0) {
      throw new BadRequestError('Violation threshold must be greater than 0');
    }
  }

  /**
   * Validate policy actions
   */
  private validateActions(actions: any): void {
    if (actions.allowAppeal && actions.appealDeadlineDays) {
      if (actions.appealDeadlineDays <= 0) {
        throw new BadRequestError(
          'Appeal deadline must be greater than 0 days',
        );
      }
    }
  }
  async getPolicyForContext(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ) {
    const policies = await this.policyRepo.find({
      courseId,
      courseVersionId,
      ...(cohortId ? {cohortId} : {}),
      isActive: true,
    });

    // since you enforce 1 policy per cohort
    return policies[0] ?? null;
  }
}
