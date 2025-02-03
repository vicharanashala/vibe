/**
 * Institutes Fetch Slice
 *
 * This slice manages the state of institutes fetching in the application using Redux Toolkit.
 * It handles authenticated API requests to fetch institutes and manages their state.
 *
 * Features:
 * - Manages array of institute objects with their details
 * - Tracks loading state during fetch requests
 * - Provides error handling for failed requests
 * - Integrates with RTK Query endpoints for institute fetching
 *
 * State Structure:
 * - institutes: Array of institute objects containing:
 *   - id: Unique identifier for the institute
 *   - name: Institute name
 * - loading: Boolean flag for loading state
 * - error: String containing error message if any
 */

// src/store/slices/instituteSlice.ts
import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

// Type definition for institute state
interface InstituteState {
  institutes: { id: number; name: string }[]
  loading: boolean
  error: string | null
}

// Initial state with empty institutes array
const initialState: InstituteState = {
  institutes: [],
  loading: false,
  error: null,
}

const instituteSlice = createSlice({
  name: 'institute',
  initialState,
  reducers: {},
  // Handle automated state updates from API endpoints
  extraReducers: (builder) => {
    builder
      // Set loading state when fetch request starts
      .addMatcher(
        apiService.endpoints.fetchInstitutesWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      // Update institutes when fetch succeeds
      .addMatcher(
        apiService.endpoints.fetchInstitutesWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.institutes = payload.institutes
          state.loading = false
        }
      )
      // Handle errors when fetch fails
      .addMatcher(
        apiService.endpoints.fetchInstitutesWithAuth.matchRejected,
        (state, { error }) => {
          state.loading = false
          state.error = error.message || 'Failed to fetch institutes'
        }
      )
  },
})

export default instituteSlice.reducer
