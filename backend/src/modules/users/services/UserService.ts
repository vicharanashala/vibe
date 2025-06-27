import { appConfig } from '#root/config/app.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { IUser } from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {BadRequestError, NotFoundError} from 'routing-controllers';

@injectable()
export class UserService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async getUserById(userId: string): Promise<IUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }
    user._id = user._id.toString(); // Ensure id is a string
    return user;
  }

  async editUser(
    userId: string,
    userData: Partial<IUser>
  ): Promise<void> {
    return this._withTransaction(async (session) => {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }
    await this.userRepo.edit(userId, userData, session);
  });
  }

  async makeAdmin(userId: string, password: string): Promise<void> {
    return this._withTransaction(async (session) => {
      if (appConfig.adminPassword !== password) {
        throw new BadRequestError('Invalid admin password');
      }
      await this.userRepo.makeAdmin(userId, session);
    });
  }
}
