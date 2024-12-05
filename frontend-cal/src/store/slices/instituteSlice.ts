// src/store/slices/instituteSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { apiService } from '../apiService';

interface InstituteState {
  institutes: any[];
  loading: boolean;
  error: string | null;
}

const initialState: InstituteState = {
  institutes: [],
  loading: false,
  error: null,
};

const instituteSlice = createSlice({
  name: 'institute',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(apiService.endpoints.fetchInstitutesWithAuth.matchPending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addMatcher(apiService.endpoints.fetchInstitutesWithAuth.matchFulfilled, (state, { payload }) => {
        state.institutes = payload.institutes;
        state.loading = false;
      })
      .addMatcher(apiService.endpoints.fetchInstitutesWithAuth.matchRejected, (state, { error }) => {
        state.loading = false;
        state.error = error.message || 'Failed to fetch institutes';
      });
  },
});

export default instituteSlice.reducer;
