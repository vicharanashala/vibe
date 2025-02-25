// src/store/slices/studentsProgressSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { anotherApiService } from '../apiService' // Adjust the path as necessary
import axios from 'axios'

// Asynchronous thunk for fetching all students' progress
export const fetchAllStudentsProgress = createAsyncThunk(
  'studentProgress/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        'https://asia-south2-vicharanashala-calm.cloudfunctions.net/calm-ae-production/all-students-progress'
      )
      console.log('API response:', response.data)
      return response.data
    } catch (error) {
      console.error('Error in fetchAllStudentsProgress:', error)
      return rejectWithValue(
        error.response ? error.response.data : error.message
      )
    }
  }
)

const initialState = {
  AllstudentsProgress: [],
  isLoading: false,
  error: null,
}

const studentsProgressSlice = createSlice({
  name: 'studentProgress',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllStudentsProgress.pending, (state) => {
        console.log('fetchAllStudentsProgress: pending')
        state.isLoading = true
      })
      .addCase(fetchAllStudentsProgress.fulfilled, (state, action) => {
        console.log('fetchAllStudentsProgress: fulfilled', action.payload)
        state.isLoading = false
        state.AllstudentsProgress = action.payload.data // Adjust according to actual data structure
      })
      .addCase(fetchAllStudentsProgress.rejected, (state, action) => {
        console.log('fetchAllStudentsProgress: rejected', action.payload)
        state.isLoading = false
        state.error = action.payload || 'Failed to fetch students progress'
      })
  },
})

export default studentsProgressSlice.reducer
