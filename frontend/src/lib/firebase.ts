// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, 
  type Auth,
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode } from "firebase/auth";
import { useAuthStore } from "../store/auth-store";

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

const requiredFirebaseEnv = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export const missingFirebaseEnv = requiredFirebaseEnv.filter((key) => !import.meta.env[key]);
export const hasFirebaseEnv = missingFirebaseEnv.length === 0;


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth: Auth | null = hasFirebaseEnv ? getAuth(app) : null;
export const provider = hasFirebaseEnv ? new GoogleAuthProvider() : null;

// Firebase authentication functions
export const loginWithGoogle = async () => {
  if (!auth || !provider) {
    throw new Error("Firebase is not configured. Please add the required Vite Firebase environment variables.");
  }
  const result = await signInWithPopup(auth, provider);
  // Get ID token for backend authentication
  const idToken = await result.user.getIdToken();
  
  // Store the token
  useAuthStore.getState().setToken(idToken);
  
  return result;
};

export const loginWithEmail = async (email: string, password: string) => {
  if (!auth) {
    throw new Error("Firebase is not configured. Please add the required Vite Firebase environment variables.");
  }
  const result = await signInWithEmailAndPassword(auth, email, password);
  
  // Get ID token for backend authentication
  const idToken = await result.user.getIdToken();
  
  // Store the token
  useAuthStore.getState().setToken(idToken);
  
  return result;
};

// Add a function to create a user with email and password
export const createUserWithEmail = async (email: string, password: string, displayName?: string) => {
  if (!auth) {
    throw new Error("Firebase is not configured. Please add the required Vite Firebase environment variables.");
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
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
  if (!auth) {
    throw new Error("Firebase is not configured. Please add the required Vite Firebase environment variables.");
  }
  
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
  if (!auth) {
    return { valid: false, message: "Firebase is not configured." };
  }
  
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
  if (!auth) {
    throw new Error("Firebase is not configured. Please add the required Vite Firebase environment variables.");
  }
  
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
  if (auth) {
    signOut(auth);
  }
  useAuthStore.getState().clearUser();
};

export let analytics: Analytics | null = null;

if (hasFirebaseEnv) {
  void isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((error) => {
      console.warn("Firebase analytics is unavailable in this environment.", error);
    });
}
