import {SignUpBody, User, ChangePasswordBody} from '#auth/classes/index.js';
import {IAuthService} from '#auth/interfaces/IAuthService.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {InternalServerError} from 'routing-controllers';
import admin from 'firebase-admin';
import {IEnrollment, IUser} from '#root/shared/interfaces/models.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {IInviteRepository} from '#root/shared/database/interfaces/IInviteRepository.js';
import { EnrollmentRepository } from '#root/shared/index.js';
import { InviteRepository } from '#root/shared/index.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { InviteStatusType, InviteActionType } from '#root/shared/interfaces/models.js';
import { InviteResult, MailService } from '#root/modules/notifications/index.js';

import { appConfig } from '#root/config/app.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { NOTIFICATIONS_TYPES } from '#root/modules/notifications/types.js';
import { InviteService } from '#root/modules/notifications/services/InviteService.js';

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
    @inject(NOTIFICATIONS_TYPES.InviteService)
    private inviteService: InviteService,
    @inject(GLOBAL_TYPES.InviteRepo)
    private inviteRepository: InviteRepository,
    @inject(USERS_TYPES.EnrollmentService)
    private enrollmentService: EnrollmentService,
    @inject(GLOBAL_TYPES.MailService)
    private mailService: MailService,
    @inject(GLOBAL_TYPES.Database)
    private database: MongoDatabase,
  ) {
    super(database);
    if (!admin.apps.length) {
      if (appConfig.isDevelopment) {
        admin.initializeApp({
          credential: admin.credential.cert(
            {
              clientEmail: appConfig.firebase.clientEmail,
              privateKey: appConfig.firebase.privateKey.replace(/\\n/g, '\n'),
              projectId: appConfig.firebase.projectId,
            }
          ),
        });
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      }
      this.auth = admin.auth();
    }
  }
  async getCurrentUserFromToken(token: string): Promise<IUser> {
    // Verify the token and decode it to get the Firebase UID
    const decodedToken = await this.auth.verifyIdToken(token);
    const firebaseUID = decodedToken.uid;

    // Retrieve the user from our database using the Firebase UID
    const user = await this.userRepository.findByFirebaseUID(firebaseUID);
    if (!user) {
      throw new InternalServerError('User not found');
    }

    return user;
  }
  async getUserIdFromReq(req: any): Promise<string> {
    // Extract the token from the request headers
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new InternalServerError('No token provided');
    }
    await this.verifyToken(token);
    // Decode the token to get the Firebase UID
    const decodedToken = await this.auth.verifyIdToken(token);
    const firebaseUID = decodedToken.uid;
    const user = await this.userRepository.findByFirebaseUID(firebaseUID);
    if (!user) {
      throw new InternalServerError('User not found');
    }
    return user._id.toString();
  }
  async verifyToken(token: string): Promise<boolean> {
    // Decode and verify the Firebase token
    const decodedToken = await this.auth.verifyIdToken(token);
    // // Retrieve the full user record from Firebase
    // const userRecord = await this.auth.getUser(decodedToken.uid);

    // Map Firebase user data to our application user model
    if (!decodedToken) {
      return false;
    }
    return true;
  }

  async signup(body: SignUpBody): Promise<any> {
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
      throw new InternalServerError(
        `Failed to create user in Firebase: ${error.message}`,
      );
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
    
    let enrolledInvites: InviteResult[] = [];

    const invites = await this.inviteRepository.findInvitesByEmail(body.email);
    for (const invite of invites) {
      if(invite.inviteStatus === 'ACCEPTED') {
        const result = await this.enrollmentService.enrollUser(createdUserId.toString(), invite.courseId, invite.courseVersionId, invite.role, true);
        if(result && (result as any).enrollment) {
          enrolledInvites.push(new InviteResult(
            invite._id,
            invite.email,
            invite.inviteStatus,
            invite.role,
            invite.courseId,
            invite.courseVersionId,
          ));
        }
      }
    }

    return enrolledInvites.length > 0 ? {
      userId: createdUserId,
      invites: enrolledInvites,
    }: {
      userId: createdUserId,
    };
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
