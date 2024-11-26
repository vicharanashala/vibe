// src/store/store.ts

import { configureStore } from '@reduxjs/toolkit';
import { apiService } from './apiService';
import authReducer from './authSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    [apiService.reducerPath]: apiService.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiService.middleware), 
});

export default store;
