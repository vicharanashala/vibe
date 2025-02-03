/**
 * Modules Fetch Slice
 *
 * This slice manages the state of modules fetching in the application using Redux Toolkit.
 * It handles authenticated API requests to fetch modules and manages their state.
 *
 * Features:
 * - Manages array of module objects with their details
 * - Tracks loading state during fetch requests
 * - Provides error handling for failed requests
 * - Integrates with RTK Query endpoints for module fetching
 *
 * State Structure:
 * - modules: Array of module objects containing:
 *   - id: Unique identifier for the module
 *   - title: Module title
 *   - content: Module content/description
 * - loading: Boolean flag for loading state
 * - error: String containing error message if any
 */

import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

// Type definition for module state
interface ModuleState {
  modules: { id: number; title: string; content: string }[]
  loading: boolean
  error: string | null
}

// Initial state with empty modules array
const initialState: ModuleState = {
  modules: [],
  loading: false,
  error: null,
}

const moduleSlice = createSlice({
  name: 'module',
  initialState,
  reducers: {},
  // Handle automated state updates from API endpoints
  extraReducers: (builder) => {
    builder
      // Set loading state when fetch request starts
      .addMatcher(
        apiService.endpoints.fetchModulesWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      // Update modules when fetch succeeds
      .addMatcher(
        apiService.endpoints.fetchModulesWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.modules = payload.modules
          state.loading = false
        }
      )
      // Handle errors when fetch fails
      .addMatcher(
        apiService.endpoints.fetchModulesWithAuth.matchRejected,
        (state, { error }) => {
          state.loading = false
          state.error = error.message || 'Failed to fetch modules'
        }
      )
  },
})

export default moduleSlice.reducer
