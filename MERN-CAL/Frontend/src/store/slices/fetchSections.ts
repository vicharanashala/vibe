// src/store/slices/sectionsSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiService } from '../ApiServices/LmsEngine/DataFetchApiServices'

// Define async thunk using RTK Query endpoint initiation
export const fetchSectionsWithAuth = createAsyncThunk(
  'sections/fetchSectionsWithAuth',
  async ({ courseId, moduleId }, { dispatch, rejectWithValue }) => {
    const response = await dispatch(
      apiService.endpoints.fetchSectionsWithAuth.initiate({
        courseId,
        moduleId,
      })
    )
    if (response.error) {
      console.error('Error fetching sections:', response.error) // Log the error for better debugging
      return rejectWithValue('Failed to fetch sections')
    }
    const responseWithModuleId = {
      sectionData: response.data,
      moduleId: moduleId,
    }

    return responseWithModuleId // This should match the expected structure in your state
  }
)

const sectionsSlice = createSlice({
  name: 'sections',
  initialState: {
    sections: {},
    isLoading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSectionsWithAuth.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchSectionsWithAuth.fulfilled, (state, action) => {
        state.isLoading = false
        state.sections[action.payload.moduleId] = action.payload.sectionData // Adjust based on your API response structure
      })
      .addCase(fetchSectionsWithAuth.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload || 'Failed to fetch sections'
      })
  },
})

export default sectionsSlice.reducer
