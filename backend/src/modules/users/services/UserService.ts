import { appConfig } from '#root/config/app.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { IUser } from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {BadRequestError, NotFoundError} from 'routing-controllers';
import { uploadToCloudinary, deleteFromCloudinary } from '#root/shared/functions/cloudinaryUpload.js';

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

  async updateAvatar(userId: string, fileBuffer: Buffer): Promise<string> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    const oldAvatarUrl = user.avatar;
    
    // Use the userId as the public_id to ensure only one avatar exists per user
    const avatarUrl = await uploadToCloudinary(fileBuffer, 'vibe/avatars', userId);
    
    await this.userRepo.updateAvatar(userId, avatarUrl);

    // If the old avatar was NOT the same URL (e.g. from the previous random-ID system), delete it
    if (oldAvatarUrl && oldAvatarUrl !== avatarUrl) {
      deleteFromCloudinary(oldAvatarUrl).catch((err) =>
        console.error('Non-blocking old avatar deletion failed:', err)
      );
    }

    return avatarUrl;
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

