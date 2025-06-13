import {injectable, inject} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  BaseService,
  MongoDatabase,
  IUserAnomaly,
  IUserRepository,
  ICourseRepository,
} from '#shared/index.js';
import {Anomaly} from '#users/classes/transformers/Anamoly.js';
import {NotFoundError} from 'routing-controllers';

@injectable()
export class AnomalyService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
  ) {
    super(mongoDatabase);
  }

  async createAnomaly(anamoly: Anomaly): Promise<IUserAnomaly> {
    return this._withTransaction(async session => {
      // Validate user exists
      const user = await this.userRepo.findById(anamoly.userId.toString());
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Validate course exists
      const course = await this.courseRepo.read(
        anamoly.courseId.toString(),
        session,
      );
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      // Create anomaly
      const createdAnomaly = await this.userRepo.createUserAnomaly(
        anamoly,
        session,
      );
      if (!createdAnomaly) {
        throw new Error('Failed to create anomaly');
      }
      return createdAnomaly;
    });
  }
}
