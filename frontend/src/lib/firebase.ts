// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  fetchSignInMethodsForEmail } from "firebase/auth";
import { useAuthStore } from "../store/auth-store";
import { useLoginWithGoogle } from "@/hooks/hooks";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Firebase authentication functions
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, provider);
  // Get ID token for backend authentication
  const idToken = await result.user.getIdToken();
  
  // Store the token
  useAuthStore.getState().setToken(idToken);
  
  return result;
};

/**
 * `signInWithEmailAndPassword` alone can't tell "wrong password" apart from
 * "this email only has a Google account" -- recent Firebase Auth versions
 * collapse both into the same generic auth/invalid-credential error for
 * security (so a failed login can't be used to probe which emails are
 * registered). fetchSignInMethodsForEmail is the *documented* way to try to
 * tell them apart, but it's best-effort only: projects with Firebase's email
 * enumeration protection enabled make it return an empty list unconditionally,
 * same as the error code above -- when that happens this silently returns
 * null (see below) rather than claiming an answer it doesn't have. The
 * backend's Admin-SDK-based lookup (FirebaseAuthService.getSignInProviders)
 * is not subject to that restriction and is the reliable version of this
 * check; this client-side one is a nice-to-have on top when it works.
 *
 * Returns null when there's nothing more specific to say than the original
 * error already conveys, so callers can fall back to their own handling
 * (several callers switch on error.code themselves) instead of this
 * silently overwriting a message they already handle better.
 */
const describeGoogleOnlyAccountError = async (email: string, error: any): Promise<string | null> => {
  const code = error?.code;
  if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential' && code !== 'auth/wrong-password') {
    return null;
  }
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods.length > 0 && !methods.includes('password')) {
      const provider = methods.includes('google.com') ? 'Google Sign-In' : methods[0];
      return `This email is registered with ${provider}. Please use that to sign in instead.`;
    }
  } catch {
    // Best-effort -- fall through to null if this lookup itself fails.
  }
  return null;
};

export const loginWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);

    // Get ID token for backend authentication
    const idToken = await result.user.getIdToken();

    // Store the token
    useAuthStore.getState().setToken(idToken);

    return result;
  } catch (error: any) {
    const message = await describeGoogleOnlyAccountError(email, error);
    if (message) {
      // Preserve the original code so callers with their own code-based
      // error handling (there are a couple) still see a recognizable error.
      const wrapped = new Error(message);
      (wrapped as any).code = error?.code;
      throw wrapped;
    }
    throw error;
  }
};

// Add a function to create a user with email and password
export const createUserWithEmail = async (email: string, password: string, displayName?: string) => {
  const auth = getAuth(app);
  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    if (error?.code === 'auth/email-already-in-use') {
      let message = 'An account with this email already exists. Please sign in instead.';
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.includes('google.com') && !methods.includes('password')) {
          message = 'This email already has an account via Google Sign-In. Please use "Continue with Google" instead.';
        }
      } catch {
        // Best-effort -- fall back to the generic message above if this lookup itself fails.
      }
      const wrapped = new Error(message);
      (wrapped as any).code = error.code;
      throw wrapped;
    }
    if (error?.code === 'auth/weak-password' || error?.code === 'auth/invalid-email') {
      // Firebase's own default message for these is a raw "Firebase: Error
      // (auth/weak-password)." string, not something to show a user.
      const message = error.code === 'auth/weak-password'
        ? 'Password is too weak. Please choose a stronger password.'
        : 'Invalid email address.';
      const wrapped = new Error(message);
      (wrapped as any).code = error.code;
      throw wrapped;
    }
    throw error;
  }

  // Update user profile if display name is provided
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, {
      displayName
    });
  }

  return userCredential;
};

/**
 * Sends a password reset email to the user
 * Firebase automatically handles email delivery
 */
export const sendPasswordResetEmail = async (email: string) => {
  const auth = getAuth(app);
  
  try {
    // This triggers Firebase to send password reset email
    await firebaseSendPasswordResetEmail(auth, email, {
      // URL where user will be redirected after clicking link
      url: `${window.location.origin}/reset-password`,
      handleCodeInApp: true,
    });
    
    return {
      success: true,
      message: 'Password reset email sent! Check your inbox.',
    };
  } catch (error: any) {
    console.error('Password reset error:', error);
    
    let message = 'Failed to send reset email. Please try again.';
    
    if (error.code === 'auth/user-not-found') {
      message = 'No account found with this email address.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Invalid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      message = 'Too many requests. Please try again later.';
    }
    
    throw new Error(message);
  }
};

/**
 * Verifies a password reset code is valid
 */
export const verifyResetCode = async (code: string) => {
  const auth = getAuth(app);
  
  try {
    const email = await verifyPasswordResetCode(auth, code);
    return { valid: true, email };
  } catch (error: any) {
    console.error('Verify reset code error:', error);
    
    let message = 'Invalid or expired reset code.';
    
    if (error.code === 'auth/invalid-action-code') {
      message = 'This reset link has already been used or is invalid.';
    } else if (error.code === 'auth/expired-action-code') {
      message = 'This reset link has expired. Please request a new one.';
    }
    
    return { valid: false, message };
  }
};

/**
 * Resets password using the code from email
 */
export const resetPassword = async (code: string, newPassword: string) => {
  const auth = getAuth(app);
  
  try {
    await confirmPasswordReset(auth, code, newPassword);
    return {
      success: true,
      message: 'Password reset successfully!',
    };
  } catch (error: any) {
    console.error('Password reset error:', error);
    
    let message = 'Failed to reset password. Please try again.';
    
    if (error.code === 'auth/invalid-action-code') {
      message = 'This reset link has already been used or is invalid.';
    } else if (error.code === 'auth/expired-action-code') {
      message = 'This reset link has expired. Please request a new one.';
    } else if (error.code === 'auth/weak-password') {
      message = 'Password is too weak. Please choose a stronger password.';
    }
    
    throw new Error(message);
  }
};

export const logout = () => {
  signOut(auth);
  useAuthStore.getState().clearUser();
};

export const analytics = getAnalytics(app);