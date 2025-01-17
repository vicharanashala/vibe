import { createSlice } from '@reduxjs/toolkit'
import { apiService } from '../apiService'

interface ModuleState {
  modules: { id: number; title: string; content: string }[]
  loading: boolean
  error: string | null
}

const initialState: ModuleState = {
  modules: [],
  loading: false,
  error: null,
}

const moduleSlice = createSlice({
  name: 'module',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(
        apiService.endpoints.fetchModulesWithAuth.matchPending,
        (state) => {
          state.loading = true
          state.error = null
        }
      )
      .addMatcher(
        apiService.endpoints.fetchModulesWithAuth.matchFulfilled,
        (state, { payload }) => {
          state.modules = payload.modules
          state.loading = false
        }
      )
      .addMatcher(
        apiService.endpoints.fetchModulesWithAuth.matchRejected,
        (state, { error }) => {
          state.loading = false
          state.error = error.message || 'Failed to fetch modules'
        }
      )
  },
})

export default moduleSlice.reducer
