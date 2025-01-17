import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

interface CourseState {
  courses: {
    course_id: number
    name: string
    description: string
    visibility: string
    created_at: string
  }[]
  loading: boolean
  error: string | null
}

const initialState: CourseState = {
  courses: [],
  loading: false,
  error: null,
}

const courseSlice = createSlice({
  name: 'course',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(
        apiService.endpoints.fetchCoursesWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      .addMatcher(
        apiService.endpoints.fetchCoursesWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.courses = payload.courses
          state.loading = false
        }
      )
      .addMatcher(
        apiService.endpoints.fetchCoursesWithAuth.matchRejected,
        (state, { error }) => {
          state.loading = false
          state.error = error.message || 'Failed to fetch courses'
        }
      )
  },
})

export default courseSlice.reducer
