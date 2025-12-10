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
    }
    catch (error) {
        console.log('Authorization error:', error);
        return false; // Invalid token or user not found
    }
    return true; // Authorization successful
}

// import { FirebaseAuthService } from "#root/modules/auth/services/FirebaseAuthService.js";
// import { getFromContainer } from "routing-controllers";

// export async function authorizationChecker(action): Promise<boolean> {
//   try {
//     const authHeader = action.request.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return false;
//     }

//     const token = authHeader.split(" ")[1];

//     const firebaseAuthService = getFromContainer(FirebaseAuthService);
//     const user = await firebaseAuthService.getCurrentUserFromToken(token);
//     console.log("user from authorization checker ",user)
//     // ✅ VERY IMPORTANT: attach user to request for @CurrentUser()
//     action.request.user = user;
    
//     return true;
//   } catch (error) {
//     console.error("Authorization error:", error);
//     return false;
//   }
// }
