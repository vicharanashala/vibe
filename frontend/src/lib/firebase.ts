// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useAuthStore } from "./store/auth-store";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCdPuD02drDUsjMB0QytSo2YF9Ytsx1RnQ",
  authDomain: "new-front-58c0b.firebaseapp.com",
  projectId: "new-front-58c0b",
  storageBucket: "new-front-58c0b.firebasestorage.app",
  messagingSenderId: "253149589560",
  appId: "1:253149589560:web:7d0c2fe1acb39578c8f6cd",
  measurementId: "G-K4WCX1XWRS"
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
  const auth = getAuth();
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Update user profile if display name is provided
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, {
      displayName
    });
  }
  
  return userCredential;
};

export const logout = () => {
  signOut(auth);
  useAuthStore.getState().clearUser();
};

export const analytics = getAnalytics(app);