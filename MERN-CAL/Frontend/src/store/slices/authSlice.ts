// authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { apiService, AuthResponse } from '../apiService'

export interface AuthState {
  user: { role: string; email: string; name: string } | null
  token: string | null
  isLoggedIn: boolean
  firebase_uid: string | null
}

const initialState: AuthState = {
  user: null,
  token: null,
  firebase_uid: null,
  isLoggedIn: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logoutState: (state) => {
      state.user = null
      state.token = null
      state.isLoggedIn = false
    },
    setUser: (state, action: PayloadAction<AuthResponse>) => {
      const { role, email, firebase_uid, access_token } = action.payload
      state.user = { role, email, name: firebase_uid }
      state.token = access_token
      state.isLoggedIn = true
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
            name: payload.firebase_uid,
          }
          state.token = payload.access_token
          state.isLoggedIn = true
        }
      )
      .addMatcher(
        apiService.endpoints.signup.matchFulfilled,
        (state, { payload }) => {
          state.user = {
            role: payload.role,
            email: payload.email,
            name: payload.firebase_uid,
          }
          state.token = payload.access_token
          state.isLoggedIn = true
        }
      )
      .addMatcher(apiService.endpoints.logout.matchFulfilled, (state) => {
        state.user = null
        state.token = null
        state.isLoggedIn = false
      })
  },
})

export const { setUser, logoutState } = authSlice.actions
export default authSlice.reducer
