import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { anotherApiService } from '../ApiServices/ActivityEngine/ProgressApiServices' // Ensure this path is correct

// Async thunk for fetching progress data
export const fetchModuleProgress = createAsyncThunk(
  'moduleProgress/fetchModuleProgress',
  async ({ courseInstanceId, moduleId }, { dispatch }) => {
    const response = await dispatch(
      anotherApiService.endpoints.fetchModuleProgress.initiate({
        courseInstanceId,
        moduleId,
      })
    )
    if (response.error) {
      throw new Error('Failed to fetch progress')
    }
    return response.data // Ensure this returns an object with a 'progress' key
  }
)

const moduleProgressSlice = createSlice({
  name: 'moduleProgress',
  initialState: {},
  reducers: {
    // Optionally add reducers if you need to manage other aspects of the progress state
    clearModuleProgress(state, action) {
      const itemKey = `${action.payload.courseInstanceId}-${action.payload.moduleId}`
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
      .addCase(fetchModuleProgress.pending, (state, action) => {
        // Log when the fetch starts
        const { courseInstanceId, moduleId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${moduleId}`
        console.log(`Fetching progress for key: ${progressKey}`)
      })
      .addCase(fetchModuleProgress.fulfilled, (state, action) => {
        // Properly setting the state based on fetched data
        const { courseInstanceId, moduleId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${moduleId}`
        state[progressKey] = action.payload.progress
        console.log(
          `Progress fetched and set for key: ${progressKey}:`,
          state[progressKey]
        )
      })
      .addCase(fetchModuleProgress.rejected, (state, action) => {
        // Handle errors or rejections in the fetch
        const { courseInstanceId, moduleId } = action.meta.arg
        const progressKey = `${courseInstanceId}-${moduleId}`
        console.error(
          `Error fetching progress for key: ${progressKey}`,
          action.error
        )
      })
  },
})

export const { clearModuleProgress } = moduleProgressSlice.actions
export default moduleProgressSlice.reducer
