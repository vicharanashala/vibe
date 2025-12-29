import cron from 'node-cron';
import {injectable, inject} from 'inversify';
import {
  BaseService,
  CourseRepository,
  MongoDatabase,
} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {ItemRepository} from '#root/shared/database/providers/mongo/repositories/ItemRepository.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {ProgressService} from '#root/modules/users/services/ProgressService.js';

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

  public scheduleBulkUpdateProgress() {
    // Schedule the cron job to run every hour (at minute 0)
    cron.schedule('0 * * * *', async () => {
      console.log('Running bulk update job every hour');

      // Execute the cleanup within a transaction
      await this._withTransaction(async session => {
        console.log('Step 1: Creating watchTime docs');
        await this.progressService.createBulkWatchiTimeDocs(
          '6943b2cafa4e840eb39490b6',
          '6943b2cafa4e840eb39490b7',
        );
        console.log('Step 2: Updating enrollment progress');
        await this.enrollmentService.bulkUpdateAllEnrollments(
          '6943b2cafa4e840eb39490b6',
        );
        console.log('Bulk update cron job completed successfully');
      });
    });

    console.log('Bulk update cron job scheduled to run every hour');
  }
}
