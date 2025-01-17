import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import Cookies from 'js-cookie'

interface Item {
  id: number
  name: string
  description: string
}

interface FetchItemsState {
  items: Item[]
  loading: boolean
  error: string | null
}

const initialState: FetchItemsState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchItemsWithAuth = createAsyncThunk(
  'items/fetchItemsWithAuth',
  async (sectionId: number, { rejectWithValue }) => {
    try {
      const response = await axios.get<{ items: Item[] }>(
        `/course/items/?section_id=${sectionId}`,
        {
          headers: {
            Authorization: `Bearer ${Cookies.get('access_token')}`,
          },
        }
      )
      return response.data.items
    } catch (error) {
      return rejectWithValue(error.response.data)
    }
  }
)

const fetchItemsSlice = createSlice({
  name: 'fetchItems',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchItemsWithAuth.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchItemsWithAuth.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchItemsWithAuth.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export default fetchItemsSlice.reducer
