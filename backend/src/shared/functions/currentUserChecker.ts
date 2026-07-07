import { FirebaseAuthService } from "#root/modules/auth/services/FirebaseAuthService.js";
import { ForbiddenError, getFromContainer, UnauthorizedError } from "routing-controllers";
import { CurrentUserChecker } from "routing-controllers";
import { Request } from "express";
import { IUser } from "../interfaces/models.js";

export const currentUserChecker: CurrentUserChecker = async (action): Promise<IUser> => {
  const request = action.request as Request;

  const authService = getFromContainer(FirebaseAuthService);

  // Extract the token from the Authorization header
  const token = request.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new UnauthorizedError('No token provided');
  }

  // Get the current user from the token. Translate any Firebase Admin SDK
  // failure (malformed JWT, expired token, user not in Mongo, etc.) into
  // an UnauthorizedError so the shared error handler returns HTTP 401
  // instead of leaking the raw error as a generic 500.
  let user: IUser;
  try {
    user = await authService.getCurrentUserFromToken(token);
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    let message: string;
    if (code === 'auth/id-token-expired') {
      message = 'Firebase ID token has expired.';
    } else if (code === 'auth/argument-error') {
      message = 'Malformed or invalid Firebase ID token.';
    } else if (typeof code === 'string' && code.startsWith('auth/')) {
      message = `Authentication failed: ${code}`;
    } else {
      message =
        error instanceof Error ? error.message : 'Authentication failed';
    }
    throw new UnauthorizedError(message);
  }

  return user;
}