/**
 * Questions Fetch Slice
 *
 * This slice manages the state of questions fetching in the application using Redux Toolkit.
 * It handles authenticated API requests to fetch questions for a specific assessment.
 *
 * Features:
 * - Manages array of question objects with their details
 * - Handles authenticated API requests using access token
 * - Tracks loading state during fetch requests using status enum
 * - Provides error handling for failed requests
 * - Uses createAsyncThunk for async operations
 *
 * State Structure:
 * - items: Array of question objects containing:
 *   - id: Unique identifier for the question
 *   - name: Question name/title
 *   - description: Question description/content
 * - status: Enum tracking request status ('idle'|'loading'|'succeeded'|'failed')
 * - error: String containing error message if any
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import Cookies from 'js-cookie'

// Type definition for question object
interface Question {
  id: number
  name: string
  description: string
}

// Type definition for questions state
interface FetchQuestionsState {
  items: Question[]
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
}

// Initial state with empty questions array
const initialState: FetchQuestionsState = {
  items: [],
  status: 'idle',
  error: null,
}

// Async thunk for fetching questions with authentication
export const fetchQuestionsWithAuth = createAsyncThunk(
  'questions/fetchQuestionsWithAuth',
  async (assessmentId: number, { rejectWithValue }) => {
    try {
      const response = await axios.get<{ items: Question[] }>(
        `/assessment/questions/?assessment_id=${assessmentId}`,
        {
          headers: {
            Authorization: `Bearer ${Cookies.get('access_token')}`,
          },
        }
      )
      console.log('questions .................. response', response.data)
      return response.data.items
    } catch (err) {
      return rejectWithValue(err.response.data)
    }
  }
)

// Create slice with reducers for handling async states
const fetchQuestionsSlice = createSlice({
  name: 'fetchQuestions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuestionsWithAuth.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchQuestionsWithAuth.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchQuestionsWithAuth.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message || 'Failed to fetch questions'
      })
  },
})

export default fetchQuestionsSlice.reducer
