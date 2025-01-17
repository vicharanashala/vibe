// src/store/store.ts

import { configureStore } from '@reduxjs/toolkit'
import { anotherApiService, apiService } from './apiService'
import authReducer from './slices/authSlice'
import instituteReducer from './slices/instituteSlice'
import userReducer from './slices/usersSlice'
import videoDetailsReducer from './slices/videoDetailsSlice'
import courseReducer from './slices/courseSlice'
import moduleReducer from './slices/fetchModulesSlice'

const store = configureStore({
  reducer: {
    auth: authReducer,
    institute: instituteReducer,
    user: userReducer,
    videoDetails: videoDetailsReducer,
    course: courseReducer,
    module: moduleReducer,
    [apiService.reducerPath]: apiService.reducer,
    [anotherApiService.reducerPath]: anotherApiService.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(apiService.middleware)
      .concat(anotherApiService.middleware),
})

export default store
