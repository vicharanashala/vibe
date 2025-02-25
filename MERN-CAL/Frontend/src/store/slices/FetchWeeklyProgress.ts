// src/store/slices/weeklyProgressSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { anotherApiService } from '../apiService' // Ensure this is correctly imported

export const fetchWeeklyProgress = createAsyncThunk(
  'weeklyProgress/fetchWeeklyProgress',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      // Dispatch the RTK Query endpoint and await the promise
      const resultAction = await dispatch(
        anotherApiService.endpoints.fetchWeeklyProgress.initiate()
      )

      // Correctly use unwrap after ensuring resultAction is resolved
      let response = unwrapResult(resultAction)

      console.log('API response for weekly progress:', response)
      return response
    } catch (error) {
      console.error('Error fetching weekly progress:', error)
      return rejectWithValue(
        error.data || error.message || 'An unknown error occurred'
      )
    }
  }
)

const initialState = {
  weeklyProgress: null,
  loading: false,
  error: null,
}

const weeklyProgressSlice = createSlice({
  name: 'weeklyProgress',
  initialState,
  reducers: {
    clearProgressState(state) {
      state.weeklyProgress = null
      state.loading = false
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWeeklyProgress.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchWeeklyProgress.fulfilled, (state, action) => {
        state.weeklyProgress = action.payload
        state.loading = false
      })
      .addCase(fetchWeeklyProgress.rejected, (state, action) => {
        state.error = action.error ? action.error.message : 'An error occurred'
        state.loading = false
      })
  },
})

export const { clearProgressState } = weeklyProgressSlice.actions
export default weeklyProgressSlice.reducer
function unwrapResult(resultAction: any) {
  if (resultAction.isSuccess) {
    return resultAction.data
  } else {
    throw resultAction.error || new Error('An unknown error occurred')
  }
}
