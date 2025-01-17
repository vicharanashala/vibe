// src/store/slices/usersSlice.ts
import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

interface UserState {
  users: { id: number; name: string; email: string }[]
  loading: boolean
  error: string | null
}

const initialState: UserState = {
  users: [],
  loading: false,
  error: null,
}

const usersSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(
        apiService.endpoints.fetchUsersWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      .addMatcher(
        apiService.endpoints.fetchUsersWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.users = payload.users
          state.loading = false
        }
      )
      .addMatcher(
        apiService.endpoints.fetchUsersWithAuth.matchRejected,
        (state, { error }) => {
          state.loading = false
          state.error = error.message || 'Failed to fetch users'
        }
      )
  },
})

export default usersSlice.reducer
