// src/store/slices/sectionItemsSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiService } from '../ApiServices/LmsEngine/DataFetchApiServices'

export const fetchSectionItemsWithAuth = createAsyncThunk(
  'sectionItems/fetchSectionItemsWithAuth',
  async (sectionId, { dispatch }) => {
    console.log('Thunk: Fetching section items...')
    try {
      const response = await dispatch(
        apiService.endpoints.fetchItemsWithAuth.initiate(sectionId)
      )
      console.log('Thunk: API response:', response)
      if (response.error) {
        throw new Error('Failed to fetch section items')
      }
      return {
        sectionId,
        items: response.data,
      }
    } catch (error) {
      console.error('Thunk: Error fetching section items:', error)
      throw error
    }
  }
)

const initialState = {
  items: {},
  isLoading: false,
  error: null,
}

const sectionItemsSlice = createSlice({
  name: 'sectionItems',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSectionItemsWithAuth.pending, (state) => {
        console.log('Slice: fetchSectionItemsWithAuth pending')
        state.isLoading = true
      })
      .addCase(fetchSectionItemsWithAuth.fulfilled, (state, action) => {
        console.log(
          'Slice: fetchSectionItemsWithAuth fulfilled',
          action.payload
        )
        state.isLoading = false
        state.items[action.payload.sectionId] = action.payload.items
      })
      .addCase(fetchSectionItemsWithAuth.rejected, (state, action) => {
        console.log('Slice: fetchSectionItemsWithAuth rejected', action.error)
        state.isLoading = false
        state.error = action.error.message
      })
  },
})

export default sectionItemsSlice.reducer
