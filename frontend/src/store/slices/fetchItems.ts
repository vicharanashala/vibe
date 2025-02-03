/**
 * Items Fetch Slice
 *
 * This slice manages the state of items fetching in the application using Redux Toolkit.
 * It handles authenticated API requests to fetch items for a specific section.
 *
 * Features:
 * - Manages array of item objects with their details
 * - Handles authenticated API requests using access token
 * - Tracks loading state during fetch requests
 * - Provides error handling for failed requests
 * - Uses createAsyncThunk for async operations
 *
 * State Structure:
 * - items: Array of item objects containing:
 *   - id: Unique identifier for the item
 *   - name: Item name
 *   - description: Item description
 * - loading: Boolean flag for loading state
 * - error: String containing error message if any
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import Cookies from 'js-cookie'

// Type definition for item object
interface Item {
  id: number
  name: string
  description: string
}

// Type definition for items state
interface FetchItemsState {
  items: Item[]
  loading: boolean
  error: string | null
}

// Initial state with empty items array
const initialState: FetchItemsState = {
  items: [],
  loading: false,
  error: null,
}

// Async thunk for fetching items with authentication
export const fetchItemsWithAuth = createAsyncThunk(
  'items/fetchItemsWithAuth',
  async (sectionId: number, { rejectWithValue }) => {
    try {
      // Make authenticated GET request to fetch items
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

// Create slice with reducers for handling async states
const fetchItemsSlice = createSlice({
  name: 'fetchItems',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Set loading state when fetch starts
      .addCase(fetchItemsWithAuth.pending, (state) => {
        state.loading = true
        state.error = null
      })
      // Update items when fetch succeeds
      .addCase(fetchItemsWithAuth.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      // Handle errors when fetch fails
      .addCase(fetchItemsWithAuth.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export default fetchItemsSlice.reducer
