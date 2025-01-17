import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import Cookies from 'js-cookie'

interface Question {
  id: number
  name: string
  description: string
}

interface FetchQuestionsState {
  items: Question[]
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
}

const initialState: FetchQuestionsState = {
  items: [],
  status: 'idle',
  error: null,
}

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
      return response.data.items
    } catch (err) {
      return rejectWithValue(err.response.data)
    }
  }
)

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
