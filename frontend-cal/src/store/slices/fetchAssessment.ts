/**
 * Assessment Slice
 *
 * This slice manages the state of assessments in the application using Redux Toolkit.
 * It handles assessment data and provides actions to update and clear assessment state.
 *
 * Features:
 * - Manages assessment data (id, title, description)
 * - Provides actions to set and clear assessment data
 * - Integrates with Redux store for state management
 *
 * State Structure:
 * - id: Unique identifier for the assessment (number | null)
 * - title: Assessment title (string)
 * - description: Assessment description (string)
 *
 * Actions:
 * - setAssessment: Updates assessment state with new data
 * - clearAssessment: Resets assessment state to initial values
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Type definition for assessment state
interface AssessmentState {
  id: number | null
  title: string
  description: string
}

// Initial state with empty assessment data
const initialState: AssessmentState = {
  id: null,
  title: '',
  description: '',
}

const assessmentSlice = createSlice({
  name: 'assessment',
  initialState,
  reducers: {
    // Action to update assessment state with new data
    setAssessment: (state, action: PayloadAction<AssessmentState>) => {
      state.id = action.payload.id
      state.title = action.payload.title
      state.description = action.payload.description
    },
    // Action to reset assessment state to initial values
    clearAssessment: (state) => {
      state.id = null
      state.title = ''
      state.description = ''
    },
  },
})

export const { setAssessment, clearAssessment } = assessmentSlice.actions
export default assessmentSlice.reducer
