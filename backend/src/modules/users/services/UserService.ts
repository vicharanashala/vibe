import {BaseService} from '#root/shared/classes/BaseService.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { IUser } from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {ForbiddenError, NotFoundError} from 'routing-controllers';

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
    // Allow-list the fields a user may change about themselves. Validation runs
    // with whitelist OFF, so unknown properties (e.g. `roles`) survive into the
    // body — never spread it straight into a $set, or self-edit becomes a
    // privilege-escalation vector. Keep this list in sync with EditUserBody.
    const EDITABLE_FIELDS = [
      'firstName', 'lastName', 'avatar', 'gender', 'country', 'state', 'city',
    ] as const;
    const sanitized: Partial<IUser> = {};
    for (const field of EDITABLE_FIELDS) {
      if (userData[field] !== undefined) {
        sanitized[field] = userData[field];
      }
    }
    return this._withTransaction(async (session) => {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }
    await this.userRepo.edit(userId, sanitized, session);
  });
  }

  async updateFaceReference(
    userId: string,
    profileImage: string | null,
    faceEmbedding: number[] | null,
  ): Promise<void> {
    return this._withTransaction(async (session) => {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      }
      await this.userRepo.edit(userId, { profileImage, faceEmbedding }, session);
    });
  }


  async makeAdmin(userId: string, currentUser: IUser): Promise<void> {
    // Privilege escalation guard: only an existing admin may promote another
    // user. The runtime authorizationChecker only verifies token validity (not
    // roles), so the role check must be enforced here rather than relying on
    // the @Authorized(['admin']) decorator alone.
    if (currentUser?.roles !== 'admin') {
      throw new ForbiddenError('Only an admin can promote a user to admin');
    }
    return this._withTransaction(async (session) => {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      }
      await this.userRepo.makeAdmin(userId, session);
    });
  }
}
