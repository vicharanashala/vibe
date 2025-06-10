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
import {Auth} from 'firebase-admin/lib/auth/auth';

import admin, {database} from 'firebase-admin';
import {UserRecord} from 'firebase-admin/lib/auth/user-record';
import {applicationDefault} from 'firebase-admin/app';
import {Inject, Service} from 'typedi';
import {IUser} from '../../../shared/interfaces/Models';
import {IUserRepository} from '../../../shared/database';
import {IAuthService} from '../interfaces/IAuthService';
import {ChangePasswordBody, SignUpBody} from '../classes/validators';
import {BadRequestError, InternalServerError} from 'routing-controllers';
import {User} from '../classes/transformers/User';
import {BaseService} from '../../../shared/classes/BaseService';
import {MongoDatabase} from '../../../shared/database/providers/MongoDatabaseProvider';
import {injectable, inject} from 'inversify';
import GLOBAL_TYPES from '../../../types';

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
  private auth: Auth;
  constructor(
    @inject(GLOBAL_TYPES.UserRepo)
    private userRepository: IUserRepository,

    @inject(GLOBAL_TYPES.Database)
    private database: MongoDatabase,
  ) {
    super(database);
    admin.initializeApp({
      credential: applicationDefault(),
    });
    this.auth = admin.auth();
  }

  async verifyToken(token: string): Promise<Partial<IUser>> {
    // Decode and verify the Firebase token
    // const decodedToken = await this.auth.verifyIdToken(token);
    // // Retrieve the full user record from Firebase
    // const userRecord = await this.auth.getUser(decodedToken.uid);

    // // Map Firebase user data to our application user model
    // const user: Partial<IUser> = {
    //   firebaseUID: userRecord.uid,
    //   email: userRecord.email || '',
    //   firstName: userRecord.displayName?.split(' ')[0] || '',
    //   lastName: userRecord.displayName?.split(' ')[1] || '',
    // };
    // console.log('Decoded user:', user);

    const result = await this.userRepository.findByFirebaseUID(token);

    return result;
  }

  async signup(body: SignUpBody): Promise<string> {
    let userRecord: UserRecord;
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
