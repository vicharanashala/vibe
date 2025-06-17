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

  try {
    // Get the current user from the token
    const user = await authService.getCurrentUserFromToken(token);
    return user;
  } catch (error) {
    throw new ForbiddenError('Invalid or expired token');
  }
}