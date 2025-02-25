import { createSlice } from '@reduxjs/toolkit'

export const sidebarStateSlice = createSlice({
  name: 'sidebarState',
  initialState: {
    selectedCourseId: '',
    selectedCourseName: 'Select',
    selectedModuleId: '',
    selectedModuleName: 'Select',
  },
  reducers: {
    setSelectedCourse: (state, action) => {
      state.selectedCourseId = action.payload.id
      state.selectedCourseName = action.payload.name
    },
    setSelectedModule: (state, action) => {
      state.selectedModuleId = action.payload.id
      state.selectedModuleName = action.payload.name
    },
    resetModule: (state) => {
      state.selectedModuleId = ''
      state.selectedModuleName = 'Select'
    },
  },
})

export const { setSelectedCourse, setSelectedModule, resetModule } =
  sidebarStateSlice.actions

export default sidebarStateSlice.reducer
