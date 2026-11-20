import {BaseService} from '#root/shared/classes/BaseService.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { IUser } from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  NotFoundError,
} from 'routing-controllers';
import {AUTH_TYPES} from '#root/modules/auth/types.js';
import type {IAuthService} from '#root/modules/auth/interfaces/IAuthService.js';

@injectable()
export class UserService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: IAuthService,
  ) {
    super(database);
  }

  async listAllUsers() {
    return this.userRepo.getAllUsers();
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

  /**
   * Changes a user's sign-in email, as an admin. Identity is the Firebase uid,
   * so the user keeps their password, enrolments and progress: only the email
   * on their Firebase account and on their user record change. Sends no email.
   */
  async changeEmail(
    userId: string,
    rawEmail: string,
    currentUser: IUser,
  ): Promise<{email: string; previousEmail: string; signInMethods: string[]}> {
    // Same guard as makeAdmin: the authorizationChecker only verifies the
    // token, not roles, so the admin check must live here.
    if (currentUser?.roles !== 'admin') {
      throw new ForbiddenError("Only an admin can change a user's email");
    }
    const email = rawEmail.trim().toLowerCase();

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }
    if ((user.email ?? '').trim().toLowerCase() === email) {
      throw new BadRequestError("That's already their email");
    }
    if (!user.firebaseUID) {
      throw new BadRequestError('This account has no sign-in to change');
    }

    const inMongo = await this.userRepo.findByEmail(email);
    if (inMongo && inMongo._id?.toString() !== user._id?.toString()) {
      throw new HttpError(409, 'This email is already used by another account');
    }
    const inFirebase = await this.authService.findFirebaseUidByEmail(email);
    if (inFirebase && inFirebase !== user.firebaseUID) {
      throw new HttpError(409, 'This email is already used by another account');
    }

    const {previousEmail, signInMethods} =
      await this.authService.setFirebaseEmail(user.firebaseUID, email);
    try {
      await this.userRepo.edit(userId, {email});
    } catch (error: any) {
      // Keep Firebase and the user record in step: put the old email back.
      await this.authService
        .setFirebaseEmail(user.firebaseUID, previousEmail ?? user.email)
        .catch(revertError =>
          console.error(
            `Could not revert Firebase email for user ${userId}:`,
            revertError,
          ),
        );
      if (error?.code === 11000) {
        throw new HttpError(
          409,
          'This email is already used by another account',
        );
      }
      throw error;
    }
    return {email, previousEmail: user.email, signInMethods};
  }
}
