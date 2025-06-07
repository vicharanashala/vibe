import {SignUpBody, User, ChangePasswordBody} from '#auth/classes/index.js';
import {IAuthService} from '#auth/interfaces/IAuthService.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  BaseService,
  IUserRepository,
  MongoDatabase,
  IUser,
} from '#shared/index.js';
import {injectable, inject} from 'inversify';
import {InternalServerError} from 'routing-controllers';
import admin from 'firebase-admin';

/**
 * Custom error thrown during password change operations.
 *
 * @category Auth/Errors
 */
export class ChangePasswordError extends Error {
  /**
   * Creates a new ChangePasswordError instance.
   *
   * @param message - The error message describing what went wrong
   */
  constructor(message: string) {
    super(message);
    this.name = 'ChangePasswordError';
  }
}

@injectable()
export class FirebaseAuthService extends BaseService implements IAuthService {
  private auth: any;
  constructor(
    @inject(GLOBAL_TYPES.UserRepo)
    private userRepository: IUserRepository,

    @inject(GLOBAL_TYPES.Database)
    private database: MongoDatabase,
  ) {
    super(database);
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    this.auth = admin.auth();
  }

  async verifyToken(token: string): Promise<Partial<IUser>> {
    // Decode and verify the Firebase token
    const decodedToken = await this.auth.verifyIdToken(token);
    // Retrieve the full user record from Firebase
    const userRecord = await this.auth.getUser(decodedToken.uid);

    // Map Firebase user data to our application user model
    const user: Partial<IUser> = {
      firebaseUID: userRecord.uid,
      email: userRecord.email || '',
      firstName: userRecord.displayName?.split(' ')[0] || '',
      lastName: userRecord.displayName?.split(' ')[1] || '',
    };

    return user;
  }

  async signup(body: SignUpBody): Promise<string> {
    let userRecord: any;
    try {
      // Create the user in Firebase Auth
      userRecord = await this.auth.createUser({
        email: body.email,
        emailVerified: false,
        password: body.password,
        displayName: `${body.firstName} ${body.lastName}`,
        disabled: false,
      });
    } catch (error) {
      throw new InternalServerError('Failed to create user in Firebase');
    }

    // Prepare user object for storage in our database
    const user: Partial<IUser> = {
      firebaseUID: userRecord.uid,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      roles: ['user'],
    };

    let createdUserId: string;

    await this._withTransaction(async session => {
      const newUser = new User(user);
      createdUserId = await this.userRepository.create(newUser, session);
      if (!createdUserId) {
        throw new InternalServerError('Failed to create the user');
      }
    });
    return createdUserId;
  }

  async changePassword(
    body: ChangePasswordBody,
    requestUser: IUser,
  ): Promise<{success: boolean; message: string}> {
    // Verify user exists in Firebase
    const firebaseUser = await this.auth.getUser(requestUser.firebaseUID);
    if (!firebaseUser) {
      throw new ChangePasswordError('User not found');
    }

    // Check password confirmation
    if (body.newPassword !== body.newPasswordConfirm) {
      throw new ChangePasswordError('New passwords do not match');
    }

    // Update password in Firebase Auth
    await this.auth.updateUser(firebaseUser.uid, {
      password: body.newPassword,
    });

    return {success: true, message: 'Password updated successfully'};
  }
}
