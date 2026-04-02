import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

export const provider = new GoogleAuthProvider();

export const loginWithEmail = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential;
};

export const loginWithGoogle = async () => {
  const userCredential = await signInWithPopup(auth, provider);
  return userCredential;
};

export const createUserWithEmail = async (email: string, password: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential;
};

export const sendPasswordResetEmail = async (email: string) => {
  try {
    await firebaseSendPasswordResetEmail(auth, email);
    return { success: true, message: "Password reset email sent" };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send password reset email" };
  }
};

// Alias for compatibility with ResetPasswordPage imports
export const resetPassword = sendPasswordResetEmail;

export const verifyResetCode = async (code: string, newPassword: string) => {
  try {
    await firebaseConfirmPasswordReset(auth, code, newPassword);
    return { success: true, message: "Password has been reset successfully" };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to verify reset code" };
  }
};

export const logout = async () => {
  await signOut(auth);
};

export const logoutUser = async () => {
  await signOut(auth);
};

// Persistence exports
export { setPersistence, browserLocalPersistence, browserSessionPersistence };
