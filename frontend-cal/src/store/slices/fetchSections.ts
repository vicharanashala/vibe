import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import Cookies from 'js-cookie'

interface Section {
  id: number
  title: string
  content: string
}

interface FetchSectionsPayload {
  course_id: number
  module_id: number
}

interface FetchSectionsState {
  sections: Section[]
  loading: boolean
  error: string | null
}

const initialState: FetchSectionsState = {
  sections: [],
  loading: false,
  error: null,
}

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
