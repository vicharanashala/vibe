/**
 * Sections Fetch Slice
 *
 * This slice manages the state of sections fetching in the application using Redux Toolkit.
 * It handles authenticated API requests to fetch sections for a specific course and module.
 *
 * Features:
 * - Manages array of section objects with their details
 * - Handles authenticated API requests using access token
 * - Tracks loading state during fetch requests
 * - Provides error handling for failed requests
 * - Uses createAsyncThunk for async operations
 *
 * State Structure:
 * - sections: Array of section objects containing:
 *   - id: Unique identifier for the section
 *   - title: Section title
 *   - content: Section content/description
 * - loading: Boolean flag for loading state
 * - error: String containing error message if any
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import Cookies from 'js-cookie'

// Type definition for section object
interface Section {
  id: number
  title: string
  content: string
}

// Type definition for fetch sections payload
interface FetchSectionsPayload {
  course_id: number
  module_id: number
}

// Type definition for sections state
interface FetchSectionsState {
  sections: Section[]
  loading: boolean
  error: string | null
}

// Initial state with empty sections array
const initialState: FetchSectionsState = {
  sections: [],
  loading: false,
  error: null,
}

// Async thunk for fetching sections with authentication
export const fetchSectionsWithAuth = createAsyncThunk(
  'sections/fetchSectionsWithAuth',
  async (
    { course_id, module_id }: FetchSectionsPayload,
    { rejectWithValue }
  ) => {
    try {
      const response = await axios.get(
        `/api/sections/?course_id=${course_id}&module_id=${module_id}`,
        {
          headers: {
            Authorization: `Bearer ${Cookies.get('access_token')}`,
          },
        }
      )
      return response.data.sections
    } catch (error) {
      return rejectWithValue(error.response.data)
    }
  }
)

// Create slice with reducers for handling async states
const sectionsSlice = createSlice({
  name: 'sections',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSectionsWithAuth.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSectionsWithAuth.fulfilled, (state, action) => {
        state.loading = false
        state.sections = action.payload
      })
      .addCase(fetchSectionsWithAuth.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export default sectionsSlice.reducer
