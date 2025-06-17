import {BaseService} from '#root/shared/classes/BaseService.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {NotFoundError} from 'routing-controllers';

@injectable()
export class UserService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async findByFirebaseUID(firebaseUID: string) {
    const user = await this.userRepo.findByFirebaseUID(firebaseUID);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }
}
