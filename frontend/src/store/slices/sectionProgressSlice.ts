import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { anotherApiService } from '../ApiServices/ActivityEngine/ProgressApiServices' // Ensure this path is correct

// Async thunk for fetching progress data
export const fetchSectionProgress = createAsyncThunk(
  'sectionProgress/fetchSectionProgress',
  async ({ courseInstanceId, sectionId }, { dispatch }) => {
    const response = await dispatch(
      anotherApiService.endpoints.fetchSectionProgress.initiate({
        courseInstanceId,
        sectionId,
      })
    )
    if (response.error) {
      throw new Error('Failed to fetch progress')
    }
    return response.data // Ensure this returns an object with a 'progress' key
  }
)

const sectionProgressSlice = createSlice({
  name: 'sectionProgress',
  initialState: {},
  reducers: {
    // Optionally add reducers if you need to manage other aspects of the progress state
    clearSectionProgress(state, action) {
      const itemKey = `${action.payload.courseInstanceId}-${action.payload.sectionId}`
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
      .addCase(fetchSectionProgress.pending, (state, action) => {
        // Log when the fetch starts
        const { courseInstanceId, sectionId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${sectionId}`
        console.log(`Fetching progress for key: ${progressKey}`)
      })
      .addCase(fetchSectionProgress.fulfilled, (state, action) => {
        // Properly setting the state based on fetched data
        const { courseInstanceId, sectionId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${sectionId}`
        state[progressKey] = action.payload.progress
        console.log(
          `Progress fetched and set for key: ${progressKey}:`,
          state[progressKey]
        )
      })
      .addCase(fetchSectionProgress.rejected, (state, action) => {
        // Handle errors or rejections in the fetch
        const { courseInstanceId, sectionId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${sectionId}`
        console.error(
          `Error fetching progress for key: ${progressKey}`,
          action.error
        )
      })
  },
})

export const { clearSectionProgress } = sectionProgressSlice.actions
export default sectionProgressSlice.reducer
