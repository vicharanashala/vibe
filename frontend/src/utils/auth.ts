import { auth, provider } from '../lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser // Import Firebase User type
} from 'firebase/auth';
import { useAuthStore } from '../store/auth-store'; // Removed unused User import
import { queryClient } from '../lib/client';



// Enhance mapFirebaseUserToAppUser to fetch backend user info directly
const mapFirebaseUserToAppUser = async (firebaseUser: FirebaseUser | null) => {
  if (!firebaseUser) return null;
  try {
    // Get token for backend API calls
    const token = await firebaseUser.getIdToken(true);
    useAuthStore.getState().setToken(token);

    // Fetch backend user info directly using fetch
    let backendUser = null;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BASE_URL}/users/firebase/${firebaseUser.uid}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        }
      );
      console.log('Fetching backend user:', firebaseUser.uid);
      console.log(res);
      if (res.ok) {
        backendUser = await res.json();
        console.log('Fetched backend user:', backendUser);
      }
    } catch (error) {
      console.error('Failed to fetch backend user:', error);
      // Continue with Firebase data only
    }

    // Map user with backend data
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || backendUser?.email || '',
      name: firebaseUser.displayName || 
            (backendUser ? `${backendUser.firstName} ${backendUser.lastName}`.trim() : ''),
      role: useAuthStore.getState().user?.role || null,
      avatar: firebaseUser.photoURL || '',
      userId: backendUser?._id,
      firstName: backendUser?.firstName,
      lastName: backendUser?.lastName,
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
        console.log('User authenticated:', user);
        localStorage.setItem('isAuth', 'true'); // Set auth flag in localStorage
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
  // Clear localStorage
  localStorage.removeItem('isAuth');
  localStorage.removeItem('firebase-auth-token');
  
  // Sign out from Firebase
  firebaseSignOut(auth).catch(err => console.error('Firebase logout error:', err));
  
  // Clear user from store (this will also clear localStorage via store action)
  useAuthStore.getState().clearUser();
  
  // Reset query client
  queryClient.clear();
}

// Check if user is authenticated
export function checkAuth() {
  const token = localStorage.getItem('firebase-auth-token');
  const firebaseUser = auth.currentUser;
  return !!token && !!firebaseUser;
}

// API-specific functions
// Use openapi-react-query hooks from hooks.ts
export { useLogin, useUserByFirebaseUID } from '../hooks/hooks';
