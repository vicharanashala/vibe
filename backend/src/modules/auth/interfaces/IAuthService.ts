import {SignUpBody, ChangePasswordBody, GoogleSignUpBody} from '#auth/classes/index.js';
import { InviteResult } from '#root/modules/notifications/index.js';
import {IUser} from '#shared/interfaces/models.js';

/**
 * Interface representing the authentication service.
 * Defines the contract that any authentication service implementation
 * must fulfill, regardless of the underlying authentication provider.
 *
 * @category Auth/Interfaces
 */
export interface IAuthService {
  /**
   * Signs up a new user in the system.
   * Creates a new user account with the provided credentials and
   * stores the user information in the database.
   *
   * @param body - The validated payload containing user registration information
   *               including email, password, first name, and last name
   * @returns A promise that resolves to the newly created user object
   * @throws Error - If user creation fails for any reason
   */
  signup(body: SignUpBody): Promise<InviteResult[] | string | null>;
  googleSignup( body: GoogleSignUpBody, token: string): Promise<InviteResult[] | string | null>;
  getUserIdFromReq(req: any): Promise<string>;
  /**
   * Changes the password for an authenticated user.
   * Validates that the new password meets requirements and updates
   * the user's credentials in the authentication system.
   *
   * @param body - The payload containing the new password and confirmation
   * @param requestUser - The authenticated user requesting the password change
   * @returns A promise that resolves to a confirmation object with success status and message
   * @throws Error - If password change fails or validation errors occur
   */
  changePassword(
    body: ChangePasswordBody,
    requestUser: IUser,
  ): Promise<{success: boolean; message: string}>;

  /**
   * Retrieves the currently authenticated user based on the provided token.
   * This method extracts the user information from the token and returns
   * the user object if found.
   *
   * @param token - The authentication token used to identify the user
   * @returns A promise that resolves to the authenticated user object or null if not found
   */
  getCurrentUserFromToken(token: string): Promise<IUser | null>;
  updateFirebaseUser(
    firebaseUID: string,
    body: Partial<IUser>,
  ): Promise<void>;

  /**
   * Creates a passwordless identity for a share-link recipient, who is
   * identified by the link's token rather than by signing in.
   */
  createGuestFirebaseUser(email: string, displayName: string): Promise<string>;

  /**
   * Mints a custom token the client exchanges for an ID token, so a share-link
   * viewer can call the normal APIs without signing up.
   */
  createCustomToken(firebaseUID: string): Promise<string>;
}

/**
 * Represents an authenticated HTTP request with user information.
 *
 * Extends Express's standard Request object to include
 * user information associated with the authenticated session.
 *
 * This interface helps controllers access the currently authenticated user directly.
 *
 * The `authorizationChecker` function configured in Routing Controllers Options
 * from the `routing-controllers` package populates the `user` property.
 *
 */
export interface AuthenticatedRequest extends Request {
  /**
   * The authenticated user making the request.
   * Contains all user information including ID, email, name, and roles.
   */
  user: IUser;
}
