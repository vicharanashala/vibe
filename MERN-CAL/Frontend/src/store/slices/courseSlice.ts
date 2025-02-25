// src/store/slices/coursesSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiService } from '../ApiServices/LmsEngine/DataFetchApiServices' // Adjust the path as necessary

export const fetchCoursesWithAuth = createAsyncThunk(
  'courses/fetchCoursesWithAuth',
  async (_, { dispatch }) => {
    console.log('Fetching courses...')
    const response = await dispatch(
      apiService.endpoints.fetchCoursesWithAuth.initiate()
    )
    console.log('API response:', response)
    // if (response.error) {
    //   console.error('Error in fetchCoursesWithAuth:', response.error);
    //   throw new Error('Failed to fetch courses')
    // }
    console.log('Courses fetched successfully:', response.data)
    return response.data
  }
)

const initialState = {
  courses: [],
  isLoading: false,
  error: null,
}

const coursesSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCoursesWithAuth.pending, (state) => {
        console.log('fetchCoursesWithAuth: pending')
        state.isLoading = true
      })
      .addCase(fetchCoursesWithAuth.fulfilled, (state, action) => {
        console.log('fetchCoursesWithAuth: fulfilled', action.payload)
        state.isLoading = false
        state.courses = action.payload
      })
      .addCase(fetchCoursesWithAuth.rejected, (state, action) => {
        console.log('fetchCoursesWithAuth: rejected', action.error)
        state.isLoading = false
        state.error = action.error ? action.error.message : null
      })
  },
})

export default coursesSlice.reducer
