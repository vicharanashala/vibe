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

  public async scheduleProgressUpdateCron() {
    // const courseVersionMap = [
    //   { courseId: "6968e12cbf2860d6e39051ae", versionId: "6968e12cbf2860d6e39051af" },
    //   {
    //     courseId: "6970f87e30644cbc74b6714f", versionId:
    //       "6970f87e30644cbc74b67150"
    //   },

    // ];

    cron.schedule('0 3 * * *', async () => {
      console.log(
        `⏰ Running parallel progress cron for ${/*courseVersionMap.length*/''} course versions`,
      );
    });

    // const results = await Promise.allSettled(
    //   courseVersionMap.map(({ courseId, versionId }) =>
    //     this.enrollmentService.bulkUpdateCompletedItemsCountParallelPerCourseVersion(
    //       courseId,
    //       versionId,
    //     ),
    //   ),
    // );
    // const response = await this.enrollmentService.bulkUpdateCompletedItemsCountParallelPerCourseVersion();
    // results.forEach((result, index) => {
    //   const { courseId, versionId } = courseVersionMap[index];

    //   if (result.status === 'fulfilled') {
    //     console.log(
    //       `✅ Course ${courseId} | Version ${versionId} completed`,
    //       `Total count:${result.value.totalCount}`, `Updated count:${result.value.updatedCount}`,
    //     );
    //   } else {
    //     console.error(
    //       `❌ Course ${courseId} | Version ${versionId} failed`,
    //       result.reason?.message || result.reason,
    //     );
    //   }
    // });

    // console.log(`🎉 Parallel progress cron completed \n
    //     Total count : ${response.totalCount} \n
    //     Updated count : ${response.updatedCount}`);
    // });

    // console.log('🗓️ Progress update cron scheduled (hourly, parallel)');
  }




}
