import { BaseService } from '#root/shared/classes/BaseService.js';
import { IUserActivityEvent } from '#root/shared/interfaces/models.js';
import { UserActivityEventRepository } from '#shared/database/providers/mongo/repositories/UserActivityEventRepository.js';
import { injectable, inject } from 'inversify';
import { ClientSession, ObjectId } from 'mongodb';
import {
  NotFoundError,
  BadRequestError,
  InternalServerError,
} from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';

// Interface for the request body
interface UserActivityEventRequest {
  rewinds: number;
  fastForwards: number;
  videoId: string;
  userId: string;
  courseId: string;
  versionId: string;
  rewindData: Array<{
    from: string;
    to: string;
    createdAt: string;
  }>;
  fastForwardData: Array<{
    from: string;
    to: string;
    createdAt: string;
  }>;
}

@injectable()
class UserActivityEventService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly database: any, // Inject the database provider
  ) {
    super(database);
  }

  private getUserActivityEventRepository(): UserActivityEventRepository {
    return new UserActivityEventRepository(this.database);
  }

  /**
   * Store complete user activity event data
   */
  async CreateUserActivityEvent(
    userId: string,
    data: UserActivityEventRequest,
  ): Promise<IUserActivityEvent> {
    return this._withTransaction(async (session) => {
      const repository = this.getUserActivityEventRepository();
      
      // Convert string dates to Date objects
      const processedRewindData = data.rewindData.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt)
      }));
      
      const processedFastForwardData = data.fastForwardData.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt)
      }));

      // Helper function to safely convert string to ObjectId
      const toObjectId = (id: string): ObjectId => {
        try {
          // Check if it's already a valid ObjectId format
          if (ObjectId.isValid(id)) {
            return new ObjectId(id);
          }
          // If not valid, create a new ObjectId (or handle as needed)
          console.warn(`Invalid ObjectId format: ${id}, creating new ObjectId`);
          return new ObjectId();
        } catch (error) {
          console.error(`Error converting ID to ObjectId: ${id}`, error);
          return new ObjectId();
        }
      };

      // Check if record exists and update or create new
      const existing = await repository.getUserActivityEvent(userId, data.videoId, session);
      
      if (existing) {
        // Update existing record with latest tracking data, preserve original createdAt
        const updateData = {
          rewinds: data.rewinds,
          fastForwards: data.fastForwards,
          rewindData: processedRewindData,
          fastForwardData: processedFastForwardData,
          updatedAt: new Date(),
        };
        
        const result = await repository.updateUserActivityEvent(
          userId,
          data.videoId,
          updateData,
          session
        );
        return result;
      } else {
        // Create new record with all tracking data
        const result = await repository.createUserActivityEvent(
          userId,
          data.courseId,
          data.versionId,
          data.videoId,
          session
        );
        
        // Update the new record with the actual tracking data
        const updateData = {
          rewinds: data.rewinds,
          fastForwards: data.fastForwards,
          rewindData: processedRewindData,
          fastForwardData: processedFastForwardData,
          updatedAt: new Date(),
        };
        
        const updatedResult = await repository.updateUserActivityEvent(
          userId,
          data.videoId,
          updateData,
          session
        );
        return updatedResult;
      }
    });
  }
}

export { UserActivityEventService };
