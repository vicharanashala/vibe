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

import admin from 'firebase-admin';
import {UserRecord} from 'firebase-admin/lib/auth/user-record';
import {applicationDefault} from 'firebase-admin/app';
import {Inject, Service} from 'typedi';
import {IUser} from 'shared/interfaces/Models';
import {IUserRepository} from 'shared/database';
import {IAuthService} from '../interfaces/IAuthService';
import {ChangePasswordBody, SignUpBody} from '../classes/validators';

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

/**
 * Service that implements authentication functionality using Firebase Auth.
 * Handles user registration, token verification, and password management.
 *
 * @category Auth/Services
 * @implements {IAuthService}
 */
@Service()
export class FirebaseAuthService implements IAuthService {
  /**
   * Firebase Auth instance used for authentication operations.
   */
  private auth: Auth;

  /**
   * Creates a new Firebase authentication service instance.
   * Initializes Firebase Admin SDK with application default credentials.
   *
   * @param userRepository - Repository for storing and retrieving user data
   */
  constructor(
    @Inject('UserRepository') private userRepository: IUserRepository,
  ) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
    this.auth = admin.auth();
  }

  /**
   * Verifies a Firebase authentication token and returns the associated user.
   *
   * @param token - The Firebase ID token to verify
   * @returns A promise that resolves to the user data associated with the token
   * @throws Error - If the token is invalid or verification fails
   */
  async verifyToken(token: string): Promise<IUser> {
    try {
      // Decode and verify the Firebase token
      const decodedToken = await this.auth.verifyIdToken(token);
      // Retrieve the full user record from Firebase
      const userRecord = await this.auth.getUser(decodedToken.uid);

      // Map Firebase user data to our application user model
      const user: IUser = {
        firebaseUID: userRecord.uid,
        email: userRecord.email || '',
        firstName: userRecord.displayName?.split(' ')[0] || '',
        lastName: userRecord.displayName?.split(' ')[1] || '',
        roles: ['admin', 'student'], // Assuming roles are not stored in Firebase and defaulting to 'student'
      };

      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Registers a new user with Firebase Auth and stores user data in the repository.
   *
   * @param body - The validated signup information including email, password, and name
   * @returns A promise resolving to the newly created user object
   * @throws Error - If user creation fails in either Firebase or the repository
   */
  async signup(body: SignUpBody): Promise<IUser> {
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
      throw new Error('Failed to create user in Firebase');
    }

    // Prepare user object for storage in our database
    const user: IUser = {
      firebaseUID: userRecord.uid,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      roles: ['student'],
    };

    let createdUser: IUser;

    try {
      // Store the user in our application database
      createdUser = await this.userRepository.create(user);
    } catch (error) {
      throw new Error('Failed to create user in the repository');
    }

    return createdUser;
  }

  /**
   * Changes a user's password in Firebase Auth.
   * Verifies that passwords match and the user exists before making changes.
   *
   * @param body - Contains the new password and confirmation
   * @param requestUser - The authenticated user requesting the password change
   * @returns A promise resolving to a success confirmation object
   * @throws ChangePasswordError - If passwords don't match or user doesn't exist
   */
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
