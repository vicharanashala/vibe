/**
 * Course Slice
 *
 * This slice manages the state of courses in the application using Redux Toolkit.
 * It handles course data fetching, loading states, and error handling.
 *
 * Features:
 * - Manages array of course objects with their details
 * - Tracks loading state during API requests
 * - Handles error states for failed requests
 * - Integrates with RTK Query endpoints for course fetching
 *
 * State Structure:
 * - courses: Array of course objects containing:
 *   - course_id: Unique identifier for the course
 *   - name: Course name
 *   - description: Course description
 *   - visibility: Course visibility status
 *   - created_at: Course creation timestamp
 * - loading: Boolean flag for loading state
 * - error: String containing error message if any
 */

import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

// Type definition for course state
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

// Initial state with empty courses array
const initialState: CourseState = {
  courses: [],
  loading: false,
  error: null,
}

const courseSlice = createSlice({
  name: 'course',
  initialState,
  reducers: {},
  // Handle automated state updates from API endpoints
  extraReducers: (builder) => {
    builder
      // Set loading state when fetch request starts
      .addMatcher(
        apiService.endpoints.fetchCoursesWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      // Update courses when fetch succeeds
      .addMatcher(
        apiService.endpoints.fetchCoursesWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.courses = payload.courses
          state.loading = false
        }
      )
      // Handle errors when fetch fails
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
