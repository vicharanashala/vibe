/**
 * @file FirebaseAuthService.ts
 * @description Firebase authentication service.
 * @module auth
 *
 * @author Aditya BMV
 * @organization DLED
 * @license MIT
 * @created 2025-03-06
 */

import "reflect-metadata";
import { Auth } from "firebase-admin/lib/auth/auth";
import {
  ChangePasswordPayload,
  IAuthService,
  SignUpPayload,
} from "../interfaces/IAuthService";
import admin from "firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { applicationDefault } from "firebase-admin/app";
import { Inject, Service } from "typedi";
import { IUser } from "shared/interfaces/IUser";
import { IUserRepository } from "shared/database/interfaces/IDatabase";


export class ChangePasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChangePasswordError";
  }
}

@Service()
export class FirebaseAuthService implements IAuthService {
  private auth: Auth;
  constructor(@Inject("UserRepository") private userRepository: IUserRepository) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
    this.auth = admin.auth();
  }
  async verifyToken(token: string): Promise<IUser> {
    try {
      const decodedToken = await this.auth.verifyIdToken(token);
      const userRecord = await this.auth.getUser(decodedToken.uid);

      const user: IUser = {
        firebaseUID: userRecord.uid,
        email: userRecord.email || "",
        firstName: userRecord.displayName?.split(" ")[0] || "",
        lastName: userRecord.displayName?.split(" ")[1] || "",
        roles: ["admin", "student"], // Assuming roles are not stored in Firebase and defaulting to 'student'
      };

      return user;
    } catch (error) {
      throw new Error("Invalid token");
    }
  }

  async signup(payload: SignUpPayload): Promise<any> {
    let userRecord: UserRecord;
    try {
      userRecord = await this.auth.createUser({
      email: payload.email,
      emailVerified: false,
      password: payload.password,
      displayName: `${payload.firstName} ${payload.lastName}`,
      disabled: false,
      });
    } catch (error) {
      throw new Error("Failed to create user in Firebase");
    }

    const user: IUser = {
      firebaseUID: userRecord.uid,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: ["student"],
    };

    let createdUser: IUser;
    
    try {
      createdUser  = await this.userRepository.create(user);
    } catch (error) {
      throw new Error("Failed to create user in the repository");
    }

    return createdUser;
  }

  async changePassword(
    payload: ChangePasswordPayload,
    requestUser: IUser
  ): Promise<{ success: boolean; message: string }> {
    // Verify user
    const firebaseUser = await this.auth.getUser(requestUser.firebaseUID);
    if (!firebaseUser) {
      throw new ChangePasswordError("User not found");
    }

    // Check password confirmation
    if (payload.newPassword !== payload.newPasswordConfirm) {
      throw new ChangePasswordError("New passwords do not match");
    }

    // Update password
    await this.auth.updateUser(firebaseUser.uid, {
      password: payload.newPassword,
    });

    return { success: true, message: "Password updated successfully" };
  }
}
