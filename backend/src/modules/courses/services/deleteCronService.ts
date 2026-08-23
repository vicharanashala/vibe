import cron from 'node-cron';
import { injectable, inject } from 'inversify';
import {
  BaseService,
  MongoDatabase,
} from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { ItemRepository } from '#root/shared/database/providers/mongo/repositories/ItemRepository.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { ProgressService } from '#root/modules/users/services/ProgressService.js';

/**
 * Clean up Versions, modules, Sections, ItemsGroup, items.
 *
 */

@injectable()
export class DeleteCronService extends BaseService {
  constructor(
    @inject(USERS_TYPES.ItemRepo)
    private readonly itemRepo: ItemRepository,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  public scheduleDeleteCron() {
    // Schedule the cron job to run at 1:00 AM every day
    cron.schedule('0 1 * * *', async () => {
      console.log('Running delete cron job at 1:00 AM');

      // Execute the cleanup within a transaction
      await this._withTransaction(async session => {
        await this.itemRepo.cascadeDeleteItem(session);
        console.log('Delete cron job completed successfully');
      });
    });

    console.log('Delete cron job scheduled for 1:00 AM daily');
  }

  /**
   * Nightly reconciliation of enrollment completed-item counts and percentages
   * across every course version, from watchTime records that already have an
   * endTime. This does not create or close watchTime rows — it only keeps
   * enrollment.percentCompleted/completedItemsCount in sync with what the
   * watchTime collection already shows, correcting drift from any path that
   * updates progress without going through the normal stop flow.
   *
   * Previously this call sat outside the cron.schedule callback below, so it
   * ran once — un-awaited — on every process boot instead of at 3 AM, and
   * never ran on the schedule its own log message described. On Cloud Run
   * that meant a full-database recompute on every cold start.
   */
  public scheduleProgressUpdateCron() {
    cron.schedule('0 3 * * *', async () => {
      console.log('⏰ Running nightly progress recompute cron');
      try {
        const response =
          await this.enrollmentService.bulkUpdateCompletedItemsCountParallelPerCourseVersion();
        console.log(
          `🎉 Progress recompute completed — total: ${response.totalCount}, updated: ${response.updatedCount}`,
        );
      } catch (err) {
        console.error('❌ Progress recompute cron failed:', err);
      }
    });

    console.log('Progress recompute cron scheduled for 3:00 AM daily');
  }




}
