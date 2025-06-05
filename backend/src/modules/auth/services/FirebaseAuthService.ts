/**
 * @file FirebaseAuthService.ts
 * @description Firebase authentication service implementation.
 *
 * @category Auth/Services
 * @categoryDescription
 * Service implementing authentication logic using Firebase.
 * Handles user creation, token verification, and password updates.
 */

import 'reflect-metadata';

import admin, {database} from 'firebase-admin';

import {Inject, Service} from 'typedi';
import {IUser} from '../../../shared/interfaces/models.js';
import {IUserRepository} from '../../../shared/database/index.js';
import {IAuthService} from '../interfaces/IAuthService.js';
import {ChangePasswordBody, SignUpBody} from '../classes/validators/index.js';
import {BadRequestError, InternalServerError} from 'routing-controllers';
import {User} from '../classes/transformers/User.js';
import {BaseService} from '../../../shared/classes/BaseService.js';
import {MongoDatabase} from '../../../shared/database/providers/index.js';
import {injectable, inject} from 'inversify';
import GLOBAL_TYPES from '../../../types.js';

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
    @inject(GLOBAL_TYPES.UserRepository)
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

  async signup(body: SignUpBody): Promise<IUser> {
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

    let createdUser: IUser;

    await this._withTransaction(async session => {
      createdUser = await this.userRepository.create(new User(user), session);
      if (!createdUser) {
        throw new InternalServerError('Failed to create the user');
      }
    });
    return createdUser;
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
