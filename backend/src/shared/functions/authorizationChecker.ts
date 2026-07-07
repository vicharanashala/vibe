import { FirebaseAuthService } from "#root/modules/auth/services/FirebaseAuthService.js";
import { getFromContainer } from "routing-controllers";

export async function authorizationChecker(action): Promise<boolean> {
    const firebaseAuthService = getFromContainer(FirebaseAuthService);
    const token = action.request.headers.authorization?.split(' ')[1];
    if (!token) {
        return false; // No token provided
    }
    try {
        await firebaseAuthService.getCurrentUserFromToken(token);
    } catch (error: unknown) {
        // Log without the stack trace so we can see bad-token patterns in
        // dev without spamming production logs. Authentication failures are
        // an expected outcome of client retries and should never crash.
        const code = (error as { code?: string })?.code;
        const msg = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV !== 'production') {
            console.log('[authorizationChecker]', code ?? 'no-code', '-', msg);
        }
        return false; // Invalid token or user not found
    }
    return true; // Authorization successful
}