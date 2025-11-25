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

/**
 * Clean up Versions, modules, Sections, ItemsGroup, items.
 *
 */

@injectable()
export class DeleteCronService extends BaseService {
  constructor(
    @inject(USERS_TYPES.ItemRepo)
    private readonly itemRepo: ItemRepository,

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
}
