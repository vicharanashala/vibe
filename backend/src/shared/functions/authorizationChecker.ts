import { FirebaseAuthService } from "#root/modules/auth/services/FirebaseAuthService.js";
import { getFromContainer } from "routing-controllers";

export async function authorizationChecker(action): Promise<boolean> {
    const firebaseAuthService = getFromContainer(FirebaseAuthService);
    const token = action.request.headers.authorization?.split(' ')[1];
    console.log('Authorization token:', token);
    if (!token) {
        return false; // No token provided
    }
    try {
        await firebaseAuthService.getCurrentUserFromToken(token);
    }
    catch (error) {
        console.log('Authorization error:', error);
        return false; // Invalid token or user not found
    }
    return true; // Authorization successful
}