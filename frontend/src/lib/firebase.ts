import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, 
  connectAuthEmulator,
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

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "vibe-5b35a.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "vibe-5b35a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "vibe-5b35a.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:123456789",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Connect to Firebase Auth Emulator in local dev mode
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true" || import.meta.env.DEV;
if (useEmulator) {
  const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST || "http://127.0.0.1:9099";
  try {
    connectAuthEmulator(auth, emulatorHost, { disableWarnings: true });
  } catch (error) {
    // connectAuthEmulator throws if already connected (e.g. Vite HMR)
  }
}

// Firebase authentication functions
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, provider);
  // Get ID token for backend authentication
  const idToken = await result.user.getIdToken();
  
  // Store the token
  useAuthStore.getState().setToken(idToken);
  
  return result;
};

export const loginWithEmail = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  
  // Get ID token for backend authentication
  const idToken = await result.user.getIdToken();
  
  // Store the token
  useAuthStore.getState().setToken(idToken);
  
  return result;
};

// Add a function to create a user with email and password
export const createUserWithEmail = async (email: string, password: string, displayName?: string) => {
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