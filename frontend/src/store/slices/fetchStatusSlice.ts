// slices/progressSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { anotherApiService } from '../apiService' // Ensure this path is correct
import { ACTIVITY_URL } from '../../../constant'
import Cookies from 'js-cookie'
import axios from 'axios'

// Async thunk for fetching progress data
export const fetchProgress = createAsyncThunk(
  'progress/fetchProgress',
  async ({ courseInstanceId, sectionItemId }, { dispatch }) => {
    const response = await dispatch(
      anotherApiService.endpoints.fetchSectionItemsProgress.initiate({
        courseInstanceId,
        sectionItemId,
      })
    )
    if (response.error) {
      throw new Error('Failed to fetch progress')
    }
    console.log('response.data = ', response.data)
    return response.data // Ensure this returns an object with a 'progress' key
  }
)

export const clearAndFetchProgress = createAsyncThunk(
  'progress/clearAndFetchProgress',
  async ({ courseInstanceId, sectionItemId }, { rejectWithValue }) => {
    try {
      // Clear the progress by setting it to null (or however you manage clearing it)
      // Then fetch new progress
      const token = Cookies.get('access_token')
      const studentId = Cookies.get('user_id')
      const response = await axios.get(
        `${ACTIVITY_URL}/course-progress/section-item?courseInstanceId=${courseInstanceId}&sectionItemId=${sectionItemId}&studentId=${studentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.status === 200) {
        return {
          courseInstanceId,
          sectionItemId,
          progress: response.data.progress,
        }
      } else {
        throw new Error('Failed to fetch progress after clearing')
      }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const progressSlice = createSlice({
  name: 'progress',
  initialState: {},
  reducers: {
    // Optionally add reducers if you need to manage other aspects of the progress state
    clearProgress(state, action) {
      const itemKey = `${action.payload.courseInstanceId}-${action.payload.sectionItemId}`
      console.log('progress is deleted for = ', itemKey, state[itemKey])
      delete state[itemKey] // Correctly access and delete the progress using the composite key
      console.log('Now Current Progress State = ', state[itemKey])
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearAndFetchProgress.fulfilled, (state, action) => {
        const { courseInstanceId, sectionItemId, progress } = action.payload
        const progressKey = `${courseInstanceId}-${sectionItemId}`
        state[progressKey] = progress // Set the new progress in state
      })
      .addCase(fetchProgress.pending, (state, action) => {
        // Log when the fetch starts
        const { courseInstanceId, sectionItemId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${sectionItemId}`
      })
      .addCase(fetchProgress.fulfilled, (state, action) => {
        // Properly setting the state based on fetched data
        const { courseInstanceId, sectionItemId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${sectionItemId}`
        state[progressKey] = action.payload.progress
        console.log('Before Fetching = ', state[progressKey])
        console.log('state[progressKey] = action.payload.progress')
        console.log('After Fetching = ', state[progressKey])
      })
      .addCase(fetchProgress.rejected, (state, action) => {
        // Handle errors or rejections in the fetch
        const { courseInstanceId, sectionItemId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${sectionItemId}`
        console.error(
          `Error fetching progress for key: ${progressKey}`,
          action.error
        )
      })
  },
})

export const { clearProgress } = progressSlice.actions
export default progressSlice.reducer
