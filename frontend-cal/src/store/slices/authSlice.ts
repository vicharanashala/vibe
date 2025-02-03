/**
 * Authentication Slice
 *
 * This slice manages the authentication state of the application using Redux Toolkit.
 * It handles user authentication data, tokens, and authentication status.
 *
 * Features:
 * - Manages user data (role, email, name)
 * - Handles authentication tokens
 * - Tracks authentication status
 * - Provides actions for login, signup and logout
 * - Integrates with RTK Query endpoints
 *
 * State Structure:
 * - user: Object containing user role, email and name
 * - token: Authentication access token
 * - isAuthenticated: Boolean flag indicating auth status
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { apiService, AuthResponse } from '../apiService';

// Type definition for authentication state
interface AuthState {
  user: { role: string; email: string; name: string } | null;
  token: string | null;
  isLoggedIn: boolean;
}

// Initial state with no user authenticated
const initialState: AuthState = {
  user: null,
  token: null,
  isLoggedIn: false,  // Ensure this is synced with actual authentication status
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Action to clear auth state on logout
    logoutState: (state) => {
      state.user = null;
      state.token = null;
      state.isLoggedIn = false;
    },
    // Action to set user data on manual login
    setUser: (state, action: PayloadAction<AuthResponse>) => {
      const { role, email, full_name, access_token } = action.payload;
      state.user = { role, email, name: full_name };
      state.token = access_token;
      state.isLoggedIn = true; // Set to true on successful login
    },
  },
  // Handle automated state updates from API endpoints
  extraReducers: (builder) => {
    builder
      // Update state on successful login
      .addMatcher(
        apiService.endpoints.login.matchFulfilled,
        (state, { payload }) => {
          state.user = {
            role: payload.role,
            email: payload.email,
            name: payload.full_name,
          };
          state.token = payload.access_token;
          state.isLoggedIn = true; // Ensure this is set to true
          console.log("payload",state.isLoggedIn);
        }
      )
      // Update state on successful signup
      .addMatcher(
        apiService.endpoints.signup.matchFulfilled,
        (state, { payload }) => {
          state.user = {
            role: payload.role,
            email: payload.email,
            name: payload.full_name,
          };
          state.token = payload.access_token;
          state.isLoggedIn = true; // This was incorrect in your code snippet
        }
      )
      // Clear state on successful logout
      .addMatcher(apiService.endpoints.logout.matchFulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isLoggedIn = false; // Ensure this is set to false
        console.log("payload",state.isLoggedIn);
      });
  },
});

export const { setUser, logoutState } = authSlice.actions;
export default authSlice.reducer;
