import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { apiService, AuthResponse } from '../apiService'

interface AuthState {
  user: { role: string; email: string; name: string } | null
  token: string | null
  isAuthenticated: boolean
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logoutState: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
    },
    setUser: (state, action: PayloadAction<AuthResponse>) => {
      const { role, email, full_name, access_token } = action.payload
      state.user = { role, email, name: full_name }
      state.token = access_token
      state.isAuthenticated = true
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        apiService.endpoints.login.matchFulfilled,
        (state, { payload }) => {
          state.user = {
            role: payload.role,
            email: payload.email,
            name: payload.full_name,
          }
          state.token = payload.access_token
          state.isAuthenticated = true
        }
      )
      .addMatcher(
        apiService.endpoints.signup.matchFulfilled,
        (state, { payload }) => {
          state.user = {
            role: payload.role,
            email: payload.email,
            name: payload.full_name,
          }
          state.token = payload.access_token
          state.isAuthenticated = true
        }
      )
      .addMatcher(apiService.endpoints.logout.matchFulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
      })
  },
})

export const { setUser, logoutState } = authSlice.actions
export default authSlice.reducer
