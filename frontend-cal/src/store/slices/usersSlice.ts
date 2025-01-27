/**
 * Users Fetch Slice
 *
 * This slice manages the state of users fetching in the application using Redux Toolkit.
 * It handles authenticated API requests to fetch users and manages their state.
 *
 * Features:
 * - Manages array of user objects with their details
 * - Tracks loading state during fetch requests
 * - Provides error handling for failed requests
 * - Integrates with RTK Query endpoints for user fetching
 *
 * State Structure:
 * - users: Array of user objects containing:
 *   - id: Unique identifier for the user
 *   - name: User's name
 *   - email: User's email address
 * - loading: Boolean flag for loading state
 * - error: String containing error message if any
 */

// src/store/slices/usersSlice.ts
import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

// Type definition for user state
interface UserState {
  users: { id: number; name: string; email: string }[]
  loading: boolean
  error: string | null
}

// Initial state with empty users array
const initialState: UserState = {
  users: [],
  loading: false,
  error: null,
}

const usersSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  // Handle automated state updates from API endpoints
  extraReducers: (builder) => {
    builder
      // Set loading state when fetch request starts
      .addMatcher(
        apiService.endpoints.fetchUsersWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      // Update users when fetch succeeds
      .addMatcher(
        apiService.endpoints.fetchUsersWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.users = payload.users
          state.loading = false
        }
      )
      // Handle errors when fetch fails
      .addMatcher(
        apiService.endpoints.fetchUsersWithAuth.matchRejected,
        (state, { error }) => {
          state.loading = false
          state.error = error.message || 'Failed to fetch users'
        }
      )
  },
})

export default usersSlice.reducer
