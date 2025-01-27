/**
 * Redux Store Configuration
 *
 * This file configures the main Redux store using Redux Toolkit's configureStore.
 * It combines multiple reducers and middleware to create a centralized state management store.
 *
 * Features:
 * - Combines multiple domain-specific reducers (auth, institute, user, etc.)
 * - Integrates RTK Query API services with their reducers and middleware
 * - Uses Redux Toolkit's default middleware configuration
 * - Provides type-safe state management
 *
 * The store includes the following slices:
 * - auth: Handles authentication state
 * - institute: Manages institute-related data
 * - user: Stores user information
 * - videoDetails: Manages video-related state
 * - course: Handles course data
 * - module: Manages module information
 */

import { configureStore } from '@reduxjs/toolkit'
import { anotherApiService, apiService } from './apiService'
import authReducer from './slices/authSlice'
import instituteReducer from './slices/instituteSlice'
import userReducer from './slices/usersSlice'
import videoDetailsReducer from './slices/videoDetailsSlice'
import courseReducer from './slices/courseSlice'
import moduleReducer from './slices/fetchModulesSlice'

// Configure the Redux store with combined reducers and middleware
const store = configureStore({
  // Combine all reducers into a single root reducer
  reducer: {
    auth: authReducer,
    institute: instituteReducer,
    user: userReducer,
    videoDetails: videoDetailsReducer,
    course: courseReducer,
    module: moduleReducer,
    // Add API service reducers with their dynamic paths
    [apiService.reducerPath]: apiService.reducer,
    [anotherApiService.reducerPath]: anotherApiService.reducer,
  },
  // Configure middleware - combine default middleware with API service middleware
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(apiService.middleware)
      .concat(anotherApiService.middleware),
})

export default store
