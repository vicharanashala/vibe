// src/store/slices/videoDetailsSlice.ts
import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

interface VideoDetailsState {
  videoDetails: { id: number; title: string; url: string }[]
  loading: boolean
  error: string | null
}

const initialState: VideoDetailsState = {
  videoDetails: [],
  loading: false,
  error: null,
}

const videoDetailsSlice = createSlice({
  name: 'videoDetails',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(
        apiService.endpoints.fetchVideoDetailsWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      .addMatcher(
        apiService.endpoints.fetchVideoDetailsWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.videoDetails = payload.videoDetails
          state.loading = false
        }
      )
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
