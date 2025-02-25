// src/store/slices/modulesSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiService } from '../ApiServices/LmsEngine/DataFetchApiServices'

// Define async thunk using RTK Query endpoint initiation
export const fetchModulesWithAuth = createAsyncThunk(
  'modules/fetchModulesWithAuth',
  async (courseId, { dispatch, rejectWithValue }) => {
    const response = await dispatch(
      apiService.endpoints.fetchModulesWithAuth.initiate(courseId)
    )
    if (response.error) {
      console.error('Error fetching modules:', response.error) // Log the error for better debugging
      return rejectWithValue('Failed to fetch modules')
    }
    const responseWithCourseId = {
      moduleData: response.data,
      courseId: courseId,
    }

    return responseWithCourseId // This should match the expected structure in your state
  }
)

const initialState = {
  modules: {},
  isLoading: false,
  error: null,
}

const modulesSlice = createSlice({
  name: 'modules',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchModulesWithAuth.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchModulesWithAuth.fulfilled, (state, action) => {
        state.isLoading = false
        console.log('action.payload', action.payload)
        state.modules[action.payload.courseId] = action.payload.moduleData // Adjust based on your API response structure
        console.log("i am module data .............",action.payload.moduleData)
      })
      .addCase(fetchModulesWithAuth.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload || 'Failed to fetch modules'
      })
  },
})

export default modulesSlice.reducer
