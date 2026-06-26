import {
  SignUpBody,
  User,
  ChangePasswordBody,
  GoogleSignUpBody,
} from '#auth/classes/index.js';
import {IAuthService} from '#auth/interfaces/IAuthService.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {BadRequestError, InternalServerError} from 'routing-controllers';
import admin from 'firebase-admin';
import {IUser} from '#root/shared/interfaces/models.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {InviteRepository} from '#root/shared/index.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {InviteResult, MailService} from '#root/modules/notifications/index.js';
import {appConfig} from '#root/config/app.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {NOTIFICATIONS_TYPES} from '#root/modules/notifications/types.js';
import {InviteService} from '#root/modules/notifications/services/InviteService.js';

/**
 * Derive display-safe first/last names for a new user.
 *
 * The signup validators enforce /^[A-Za-z ]+$/ on firstName (required) and
 * lastName (optional), and every UI/leaderboard/export path falls back to
 * "Unknown User" when firstName is blank. Firebase `displayName` is frequently
 * absent (email/password accounts, some SSO), which previously produced empty
 * names that BOTH render as "Unknown User" and fail validation on the next
 * profile save. We therefore:
 *   1. keep only alphabetic characters + spaces — this strips digits/dots from
 *      an email local-part (e.g. "sghara200" -> "sghara", "john.doe" -> "john doe"),
 *      so the result always satisfies the firstName regex;
 *   2. fall back to the sanitized email local-part when no usable name is given;
 *   3. fall back to "User" when even the email yields nothing alphabetic.
 *
 * Keep in sync with
 * backend/src/modules/users/scripts/backfillEmptyUserNames.ts
 *
 * @category Auth
 */
export function deriveUserNames(
  rawFirstName: string | undefined | null,
  rawLastName: string | undefined | null,
  email: string | undefined | null,
): {firstName: string; lastName: string} {
  const sanitize = (s: string | undefined | null): string =>
    (s ?? '')
      .replace(/[^A-Za-z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  let firstName = sanitize(rawFirstName);
  const lastName = sanitize(rawLastName);

  if (!firstName) {
    const localPart = (email ?? '').split('@')[0];
    firstName = sanitize(localPart);
  }

  // A single stray letter (e.g. "21f2000891" -> "f" for roll-number emails)
  // is a meaningless name; persist the honest generic instead. firstName is
  // required + validated, so unlike the backfill we cannot leave it blank.
  if (firstName.replace(/ /g, '').length < 2) {
    firstName = 'User';
  }

  return {firstName, lastName};
}

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
          credential: admin.credential.cert({
            clientEmail: appConfig.firebase.clientEmail,
            privateKey: appConfig.firebase.privateKey.replace(/\\n/g, '\n'),
            projectId: appConfig.firebase.projectId,
          }),
        });
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      }
    }
    this.auth = admin.auth();
  }
  async getCurrentUserFromToken(token: string): Promise<IUser> {
    // Verify the token and decode it to get the Firebase UID
    const decodedToken = await this.auth.verifyIdToken(token);
    const firebaseUID = decodedToken.uid;
    // Retrieve the user from our database using the Firebase UID
    let user = await this.userRepository.findByFirebaseUID(firebaseUID);
    if (!user) {
      // get user data from Firebase
      try {
        const firebaseUser = await this.auth.getUser(firebaseUID);
        if (!firebaseUser) {
          throw new InternalServerError('Firebase user not found');
        }
        // Map Firebase user data to our application user model
        const userData: GoogleSignUpBody = {
          email: firebaseUser.email,
          firstName: firebaseUser.displayName?.split(' ')[0] || '',
          lastName: firebaseUser.displayName?.split(' ')[1] || '',
        };
        await this.googleSignup(userData, token);
        user = await this.userRepository.findByFirebaseUID(firebaseUID);
        if (!user) {
          throw new InternalServerError('Failed to create the user');
        }
      } catch (error) {
        throw new InternalServerError(
          `Failed to retrieve user from Firebase: ${error.message}`,
        );
      }
    }
    user._id = user._id.toString();
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
    // ==========================================================
    // FIX: Check if user already exists by email
    // ==========================================================
    const existingUser = await this.userRepository.findByEmail(body.email);
    if (existingUser) {
      throw new InternalServerError('User with this email already exists');
    }

    let userRecord: any;
    try {
      // Create the user in Firebase Auth
      userRecord = await this.auth.createUser({
        email: body.email,
        emailVerified: false,
        password: body.password,
        displayName: `${body.firstName} ${body.lastName || ''}`,
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
      lastName: body.lastName || '',
      profileImage: body.profileImage,
      faceEmbedding: body.faceEmbedding,
      roles: 'user',
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
    await this.inviteRepository.updateUserToNotNewUser(body.email);

    for (const invite of invites) {
      if (invite.inviteStatus === 'ACCEPTED') {
        const result = await this.enrollmentService.enrollUser(
          createdUserId.toString(),
          invite.courseId.toString(),
          invite.courseVersionId.toString(),
          invite.role,
          true,
        );
        if (result && (result as any).enrollment) {
          enrolledInvites.push(
            new InviteResult(
              invite._id,
              invite.email,
              invite.inviteStatus,
              invite.role,
              invite.acceptedAt,
              invite.courseId,
              invite.courseVersionId,
            ),
          );
        }
      }
    }

    return enrolledInvites.length > 0
      ? {
          userId: createdUserId,
          invites: enrolledInvites,
        }
      : {
          userId: createdUserId,
        };
  }

  async googleSignup(body: GoogleSignUpBody, token: string): Promise<any> {
    await this.verifyToken(token);
    // Decode the token to get the Firebase UID
    const decodedToken = await this.auth.verifyIdToken(token);
    const firebaseUID = decodedToken.uid;

    // ==========================================================
    // FIX: Check if user already exists before creating
    // ==========================================================
    const existingUserByEmail = await this.userRepository.findByEmail(
      body.email,
    );
    if (existingUserByEmail) {
      // User already exists, return existing user ID
      return {
        userId: existingUserByEmail._id.toString(),
      };
    }

    const existingUserByUID = await this.userRepository.findByFirebaseUID(
      firebaseUID,
    );
    if (existingUserByUID) {
      // User already exists, return existing user ID
      return {
        userId: existingUserByUID._id.toString(),
      };
    }

    // Face photo is optional at signup. Students who enter a course that
    // requires face recognition will be redirected to complete their face
    // registration before proctoring can start.
    if (body.faceEmbedding && body.faceEmbedding.length !== 128) {
      throw new BadRequestError(
        'Face embedding must be exactly 128 numbers.',
      );
    }

    // Firebase displayName is often missing (email/password, some SSO), which
    // would otherwise persist a blank firstName -> renders as "Unknown User"
    // everywhere and fails the firstName regex on the next profile save.
    const {firstName, lastName} = deriveUserNames(
      body.firstName,
      body.lastName,
      body.email,
    );

    const user: Partial<IUser> = {
      firebaseUID: firebaseUID,
      email: body.email,
      firstName,
      lastName,
      profileImage: body.profileImage,
      faceEmbedding: body.faceEmbedding,
      roles: 'user',
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
    await this.inviteRepository.updateUserToNotNewUser(body.email);
    for (const invite of invites) {
      if (invite.inviteStatus === 'ACCEPTED') {
        const result = await this.enrollmentService.enrollUser(
          createdUserId.toString(),
          invite.courseId.toString(),
          invite.courseVersionId.toString(),
          invite.role,
          true,
        );
        if (result && (result as any).enrollment) {
          enrolledInvites.push(
            new InviteResult(
              invite._id,
              invite.email,
              invite.inviteStatus,
              invite.role,
              invite.acceptedAt,
              invite.courseId,
              invite.courseVersionId,
            ),
          );
        }
      }
    }

    return enrolledInvites.length > 0
      ? {
          userId: createdUserId,
          invites: enrolledInvites,
        }
      : {
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

  async updateFirebaseUser(
    firebaseUID: string,
    body: Partial<IUser>,
  ): Promise<void> {
    // Update Firebase display name only when name fields are provided.
    if (typeof body.firstName !== 'string' && typeof body.lastName !== 'string') {
      return;
    }

    const firebaseUser = await this.auth.getUser(firebaseUID);
    const [existingFirstName = '', ...existingLastNameParts] =
      (firebaseUser.displayName || '').trim().split(' ');
    const existingLastName = existingLastNameParts.join(' ');

    const firstName = body.firstName ?? existingFirstName;
    const lastName = body.lastName ?? existingLastName;

    await this.auth.updateUser(firebaseUID, {
      displayName: `${firstName} ${lastName}`.trim(),
    });
  }
}
