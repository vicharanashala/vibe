// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut } from "firebase/auth";
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

export const loginWithGoogle = () => signInWithPopup(auth, provider);
export const loginWithEmail = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);

export const analytics = getAnalytics(app);