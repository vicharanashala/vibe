import { auth, provider } from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser // Import Firebase User type
} from 'firebase/auth';
import { useAuthStore } from '../store/auth-store'; // Removed unused User import
import { queryClient } from './client';



// Convert Firebase user to our app user model
const mapFirebaseUserToAppUser = async (firebaseUser: FirebaseUser | null) => {
  if (!firebaseUser) return null;
  
  try {
    // Get token for backend API calls
    const token = await firebaseUser.getIdToken();
    
    // Store token
    const { user } = useAuthStore.getState();
    useAuthStore.getState().setToken(token);
    
    
    // Map user
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      role: user?.role || null, // Use const assertion to match the allowed role values
      avatar: firebaseUser.photoURL || '',
    };
  } catch (error) {
    console.error('Error mapping Firebase user:', error);
    return null;
  }
};

// Initialize auth listener
export const initAuth = () => {
  const { setUser, clearUser } = useAuthStore.getState();
  
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      const user = await mapFirebaseUserToAppUser(firebaseUser);
      if (user) {
        setUser(user);
      }
    } else {
      clearUser();
    }
  });
};

// Login with Google in a popup
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = await mapFirebaseUserToAppUser(result.user);
    if (user) {
      useAuthStore.getState().setUser(user);
    }
    return result;
  } catch (error) {
    console.error('Google login error:', error);
    throw error;
  }
};

// Login with email/password
export const loginWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = await mapFirebaseUserToAppUser(result.user);
    if (user) {
      useAuthStore.getState().setUser(user);
    }
    return result;
  } catch (error) {
    console.error('Email login error:', error);
    throw error;
  }
};

// Use a single implementation of logout and checkAuth
// Logout
export function logout() {
  // Clear token
  localStorage.removeItem('auth-token');
  
  // Sign out from Firebase
  firebaseSignOut(auth).catch(err => console.error('Firebase logout error:', err));
  
  // Clear user from store
  useAuthStore.getState().clearUser();
  
  // Reset query client
  queryClient.clear();
}

// Check if user is authenticated
export function checkAuth() {
  const token = localStorage.getItem('auth-token');
  const firebaseUser = auth.currentUser;
  return !!token && !!firebaseUser;
}

// API-specific functions
// Use openapi-react-query hooks from hooks.ts
export { useLogin } from './hooks';
