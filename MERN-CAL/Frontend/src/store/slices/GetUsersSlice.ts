import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService' // Adjust the path as necessary

// Async thunk for fetching users data
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { dispatch }) => {
    const response = await dispatch(apiService.endpoints.fetchUsers.initiate()) // Ensure that the endpoint is named correctly in your apiService
    console.log('API response:', response.data)
    return response.data
  }
)

// Initial state for the users slice
const initialState = {
  users: [],
  isLoading: false,
  error: null as string | null,
}

// Slice definition
const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // Optionally add reducers for other user-related actions
    clearUsersState: (state) => {
      state.users = []
      state.isLoading = false
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false
        state.users = action.payload.data
        console.log('Fetchecsdvjhfbvbhd users:', state.users)
        state.error = null
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message
      })
  },
})

// Export the reducer
export const { clearUsersState } = usersSlice.actions
export default usersSlice.reducer
