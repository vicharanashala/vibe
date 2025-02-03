/**
 * Video Details Fetch Slice
 *
 * This slice manages the state of video details fetching in the application using Redux Toolkit.
 * It handles authenticated API requests to fetch video details and manages their state.
 *
 * Features:
 * - Manages array of video detail objects with their details
 * - Tracks loading state during fetch requests
 * - Provides error handling for failed requests
 * - Integrates with RTK Query endpoints for video details fetching
 *
 * State Structure:
 * - videoDetails: Array of video detail objects containing:
 *   - id: Unique identifier for the video
 *   - title: Video title
 *   - url: Video URL
 * - loading: Boolean flag for loading state
 * - error: String containing error message if any
 */

// src/store/slices/videoDetailsSlice.ts
import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

// Type definition for video details state
interface VideoDetailsState {
  videoDetails: { id: number; title: string; url: string }[]
  loading: boolean
  error: string | null
}

// Initial state with empty video details array
const initialState: VideoDetailsState = {
  videoDetails: [],
  loading: false,
  error: null,
}

const videoDetailsSlice = createSlice({
  name: 'videoDetails',
  initialState,
  reducers: {},
  // Handle automated state updates from API endpoints
  extraReducers: (builder) => {
    builder
      // Set loading state when fetch request starts
      .addMatcher(
        apiService.endpoints.fetchVideoDetailsWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      // Update video details when fetch succeeds
      .addMatcher(
        apiService.endpoints.fetchVideoDetailsWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.videoDetails = payload.videoDetails
          state.loading = false
        }
      )
      // Handle errors when fetch fails
      .addMatcher(
        apiService.endpoints.fetchVideoDetailsWithAuth.matchRejected,
        (state, { error }) => {
          state.loading = false
          state.error = error.message || 'Failed to fetch video details'
        }
      )
  },
})

export default videoDetailsSlice.reducer
