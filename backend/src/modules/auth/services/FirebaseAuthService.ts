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
      credential: admin.credential.cert({
        projectId: 'vibe-5b35a',
        privateKey:
          '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDau5sKXIjY97TA\nMQg7Wf5vsdS0SJj57HSlHvFEKP+W6tVO2NE7YL+caWV8X1PoJmuP1V2BY49mFoq9\nJbzKWfcGSGkzFiYrHL3ITD1rzU69UOgvFdqMhQepuLJ3CT1pbQUA9tCnwfbij5O3\nrb9cuH2Wj34KkZTpVuyof+NOII/bAphyyCTr9Ng/oY8AdDXCD3N7Zq/b3EIJID3v\ndkiRxFEf2Q9lHkLSqJJ4qK2ueDaLgyCtk58TH79c7ZyxbqcEGHluPr/2eTlf/nlJ\nVruQgOffsTjmZpV0+vLursjpEaZZUWTqbeNl7/g2CPT1pI8zZ/0jOLp+GWkKavlk\nvWOecUCfAgMBAAECggEAX5c3hYq1H6T5cDi9cTq+MFAWNge4GxkUTQk9xVzpfin4\nuLGWlw2MD64b9QOwJreLsFs9twssox/c2BbC7+frReqlVvcqDRNNeVigSxl5fND7\n93/keB63H5whGlaGaSmE00wKGhZxb8fxdYdQJxRVhlQFcFb5LhSX7nedfgpK9BnZ\n5VFrDnErHIH953W9KwWj3II3tizxRfFXhoNAwmPt8hV4s7K4ND4afDalwpUkoDAR\n/Cdcsi7bw6gI70OkyPNWDL4Qf4H0detmajXAXGcS14ULCzbTsQ7KOP/aW/0WWQev\nLCoK6cFVrqpzAcEVD69i9IHgbyUewKRuuRWpZJ/8kQKBgQD+mqbPB5D7b05vqpZP\nLRdPdOv5MIfvdqUo0jOmrLl/dIDwGYmfeGEagfKTe0u/C5MLlg9B07bNFx6HmCYQ\n1GH0ydpq0LFggNOyM5/d9kjwoI8entWoay0NCfx5X6pkOBSOTb74Z4B0MwjPTHVM\nBhopB6H/+c7unNYbzxvnFwZkWQKBgQDb7ptpHFCKxckcxB+FBfD9vdQjfR8uRB9q\nrCGKZjYjv78aAJXGLSWzz7HbXvjPlUau8+CQQNpdNs2sgDhT2/8R3ZYwHIH1mbEC\nVLfslyhpPVQm2CuIC9Q3ADLkl5fhGq+F5GbZJ6ymN+VYIh4+44GFhhSWoSpYoDJz\ny71MRx8NtwKBgQDEbIne1UaMRM4tplz6Tp5aRak8Aa4OF+nJuYnxv/YIl9hV5E3h\nwxyfN7vu/kNs68ARQz8YGP9B8OEz2TUc7M157jTdDY6bFii8pcljk/un8ScZh47s\ntWr3UUoAVcb+NKnfM6nuuONIQos8aw9fjKGoH+RiuNZmDoe8wqcTPRdIWQKBgG18\n4d13/Ri40iAB+vcMOCb6A8wPFCDCRSmju6bcr4MoiAh31hgsjaJweUiOhStCU0fx\nnQ/zWUIicE26H1CQKvFH8ObOqlwMQTS53D5qGfIaV/RmlXVK/kDLVoq6dR/ZWxw6\n0oC04Zx2IzS293uzYt2IHGPIo/4u8i73dKuulGUNAoGBALWAmVewxvKk4POHBE2p\nCl9LHSKrqp1iaIM+ov44hDqMMXCH65nptlpAChJTY8rIi4SurYFbqxHW46c/MELk\nDxbYnPA19aOXfBWfXKbPpnMAlVlSHqkmmc2XkjK2XKo9nE9Be7PYrwZmInjHpsZ+\neu9f0t4scdQqFTCSaqSPT1MT\n-----END PRIVATE KEY-----\n',
        clientEmail:
          'firebase-adminsdk-fbsvc@vibe-5b35a.iam.gserviceaccount.com',
      }),
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
    console.log('Decoded user:', user);
    console.log(this, this.userRepository);
    const result = await this.userRepository.findByFirebaseUID(token);

    return result;
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
