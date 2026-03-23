import 'reflect-metadata';
import cron from 'node-cron';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId} from 'mongodb';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {EJECTION_POLICY_TYPES} from '../types.js';
import {EjectionPolicyRepository} from '../repositories/providers/mongodb/EjectionPolicyRepository.js';
import {ManualEjectionService} from './ManualEjectionService.js';
import {EjectionPolicy} from '../classes/transformers/EjectionPolicy.js';
import {IEnrollment} from '#root/shared/interfaces/models.js';
import {NotificationService} from '#root/modules/notifications/services/NotificationService.js';

// Run at 2:00 AM every day by default — can be overridden
const DEFAULT_CRON_SCHEDULE = '0 2 * * *';

@injectable()
export class AutoEjectionEngine extends BaseService {
  private enrollmentCollection!: Collection<IEnrollment>;
  private watchTimeCollection!: Collection<any>;
  private initialized = false;

  constructor(
    @inject(EJECTION_POLICY_TYPES.EjectionPolicyRepo)
    private readonly policyRepo: EjectionPolicyRepository,

    @inject(EJECTION_POLICY_TYPES.ManualEjectionService)
    private readonly ejectionService: ManualEjectionService,

    @inject(EJECTION_POLICY_TYPES.NotificationService)
    private readonly notificationService: NotificationService,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    await this.database.connect();
    this.enrollmentCollection =
      await this.database.getCollection<IEnrollment>('enrollment');
    this.watchTimeCollection = await this.database.getCollection('watchTime');
    this.initialized = true;
  }

  /**
   * Called from startCron.ts — schedules the engine.
   */
  public scheduleAutoEjectionCron(): void {
    cron.schedule(
      DEFAULT_CRON_SCHEDULE,
      async () => {
        console.log('🔄 [AutoEjectionEngine] Starting auto-ejection run...');
        try {
          await this.runEjectionCycle();
          console.log('✅ [AutoEjectionEngine] Run completed.');
        } catch (err) {
          console.error('❌ [AutoEjectionEngine] Run failed:', err);
        }
      },
      {timezone: 'Asia/Kolkata'},
    );
    console.log(
      `✅ [AutoEjectionEngine] Scheduled at ${DEFAULT_CRON_SCHEDULE}`,
    );
  }

  /**
   * Main cycle — fetches all active policies and evaluates each one.
   * Public so it can be triggered manually for testing.
   */
  public async runEjectionCycle(): Promise<{
    policiesEvaluated: number;
    ejected: number;
    warned: number;
    errors: number;
  }> {
    await this.init();

    const stats = {policiesEvaluated: 0, ejected: 0, warned: 0, errors: 0};

    // Fetch all active course policies
    const policies = await this.policyRepo.find({isActive: true});
    stats.policiesEvaluated = policies.length;

    console.log(
      `[AutoEjectionEngine] Evaluating ${policies.length} active policies`,
    );

    for (const policy of policies) {
      try {
        const result = await this.evaluatePolicy(policy);
        stats.ejected += result.ejected;
        stats.warned += result.warned;
        stats.errors += result.errors;
      } catch (err) {
        console.error(
          `[AutoEjectionEngine] Error evaluating policy ${policy._id}:`,
          err,
        );
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Evaluate a single policy against all enrolled students in its cohort.
   */
  private async evaluatePolicy(policy: EjectionPolicy): Promise<{
    ejected: number;
    warned: number;
    errors: number;
  }> {
    const stats = {ejected: 0, warned: 0, errors: 0};

    // Only process policies that have at least one enabled trigger
    const triggers = policy.triggers;
    if (!triggers) return stats;

    // Fetch all active non-ejected students for this policy's cohort
    const students = await this.getActiveStudentsForPolicy(policy);

    if (students.length === 0) return stats;

    console.log(
      `[AutoEjectionEngine] Policy ${policy._id} — evaluating ${students.length} students`,
    );

    for (const student of students) {
      try {
        const result = await this.evaluateStudent(policy, student);
        if (result === 'ejected') stats.ejected++;
        else if (result === 'warned') stats.warned++;
      } catch (err) {
        console.error(
          `[AutoEjectionEngine] Error evaluating student ${student.userId}:`,
          err,
        );
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Evaluate a single student against all enabled triggers on a policy.
   * Returns the most severe action taken.
   */
  private async evaluateStudent(
    policy: EjectionPolicy,
    student: IEnrollment,
  ): Promise<'ejected' | 'warned' | 'none'> {
    const triggers = policy.triggers;

    // ── Inactivity trigger ─────────────────────────────────────────
    if (triggers.inactivity?.enabled) {
      const result = await this.evaluateInactivityTrigger(policy, student);
      if (result === 'ejected') return 'ejected';
      if (result === 'warned') return 'warned';
    }

    return 'none';
  }

  /**
   * Evaluate the inactivity trigger for a student.
   *
   * Logic:
   * - Get the most recent watchtime entry for this student in this cohort
   * - If lastActive > thresholdDays ago → eject
   * - If lastActive > (thresholdDays - warningDays) ago → warn (TODO: T-03)
   * - If no watchtime at all, use enrollment date as the baseline
   */
  private async evaluateInactivityTrigger(
    policy: EjectionPolicy,
    student: IEnrollment,
  ): Promise<'ejected' | 'warned' | 'none'> {
    const {thresholdDays, warningDays} = policy.triggers.inactivity!;

    const now = new Date();

    // Get last activity timestamp
    const lastActivity = await this.watchTimeCollection.findOne(
      {
        userId: student.userId,
        courseId: student.courseId,
        courseVersionId: student.courseVersionId,
        cohortId: student.cohortId ?? {$exists: false},
        isDeleted: {$ne: true},
      },
      {sort: {startTime: -1}, projection: {startTime: 1}},
    );

    // Baseline: last active time or enrollment date
    const lastActiveDate: Date =
      lastActivity?.startTime ?? student.enrollmentDate;
    const daysSinceActive = Math.floor(
      (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    console.log(
      `[AutoEjectionEngine] Student ${student.userId} — inactive for ${daysSinceActive} days (threshold: ${thresholdDays}, warning: ${thresholdDays - warningDays})`,
    );

    if (daysSinceActive >= thresholdDays) {
      // Eject the student
      console.log(
        `[AutoEjectionEngine] Ejecting student ${student.userId} — inactive ${daysSinceActive} days`,
      );

      await this.ejectionService.ejectLearner(
        student.userId.toString(),
        student.courseId.toString(),
        student.courseVersionId.toString(),
        `Automatically ejected: inactive for ${daysSinceActive} days (threshold: ${thresholdDays} days)`,
        'SYSTEM', // ejectedBy — system actor
        student.cohortId?.toString(),
        policy._id.toString(),
      );

      return 'ejected';
    }

    if (daysSinceActive >= thresholdDays - warningDays) {
      console.log(
        `[AutoEjectionEngine] Warning: student ${student.userId} inactive ${daysSinceActive} days`,
      );

      await this.notificationService.notifyInactivityWarning(
        student.userId.toString(),
        student.courseId.toString(),
        student.courseVersionId.toString(),
        daysSinceActive,
        thresholdDays,
        student.cohortId?.toString(),
      );

      return 'warned';
    }

    return 'none';
  }

  /**
   * Fetch all active, non-ejected STUDENT enrollments for a policy's scope.
   */
  private async getActiveStudentsForPolicy(
    policy: EjectionPolicy,
  ): Promise<IEnrollment[]> {
    const query: any = {
      role: 'STUDENT',
      status: 'ACTIVE',
      isDeleted: {$ne: true},
      isEjected: {$ne: true},
    };

    if (policy.courseId) {
      query.courseId = new ObjectId(policy.courseId);
    }

    if (policy.courseVersionId) {
      query.courseVersionId = new ObjectId(policy.courseVersionId);
    }

    if (policy.cohortId) {
      query.cohortId = new ObjectId(policy.cohortId);
    }

    return this.enrollmentCollection.find(query).toArray();
  }
}
