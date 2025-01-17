import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AssessmentState {
  id: number | null
  title: string
  description: string
}

const initialState: AssessmentState = {
  id: null,
  title: '',
  description: '',
}

const assessmentSlice = createSlice({
  name: 'assessment',
  initialState,
  reducers: {
    setAssessment: (state, action: PayloadAction<AssessmentState>) => {
      state.id = action.payload.id
      state.title = action.payload.title
      state.description = action.payload.description
    },
    clearAssessment: (state) => {
      state.id = null
      state.title = ''
      state.description = ''
    },
  },
})

export const { setAssessment, clearAssessment } = assessmentSlice.actions
export default assessmentSlice.reducer
