// slices/progressSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { anotherApiService } from '../ApiServices/ActivityEngine/ProgressApiServices' // Ensure this path is correct

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
    return response.data // Ensure this returns an object with a 'progress' key
  }
)

const progressSlice = createSlice({
  name: 'progress',
  initialState: {},
  reducers: {
    // Optionally add reducers if you need to manage other aspects of the progress state
    clearProgress(state, action) {
      const itemKey = `${action.payload.courseInstanceId}-${action.payload.sectionItemId}`
      console.log(
        'Ratattatattatattataaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        state[itemKey]
      )
      delete state[itemKey] // Correctly access and delete the progress using the composite key
      console.log(`Progress cleared for key: ${itemKey}`)
      console.log('Ratyyyyyyyyyyyyyyyaa', state[itemKey])
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProgress.pending, (state, action) => {
        // Log when the fetch starts
        const { courseInstanceId, sectionItemId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${sectionItemId}`
        console.log(`Fetching progress for key: ${progressKey}`)
      })
      .addCase(fetchProgress.fulfilled, (state, action) => {
        // Properly setting the state based on fetched data
        const { courseInstanceId, sectionItemId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${sectionItemId}`
        state[progressKey] = action.payload.progress
        console.log(
          `Progress fetched and set for key: ${progressKey}:`,
          state[progressKey]
        )
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
