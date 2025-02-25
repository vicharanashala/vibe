// slices/progressUpdateSlice.js
import { createSlice } from '@reduxjs/toolkit'
import { anotherApiService } from '../ApiServices/ActivityEngine/UpdatingApiServices'

export const progressUpdateSlice = createSlice({
  name: 'progressUpdate',
  initialState: {},
  reducers: {
    clearProgress(state, action) {
      console.log('This is the payload : ', action.payload)
      action.payload.forEach((update) => {
        // Clear section items progress if provided
        if (update.sectionItems) {
          update.sectionItems.forEach((item) => {
            const itemKey = `${update.courseInstanceId}-${item}`
            delete state[itemKey] // Delete the progress state for each section item
            console.log(`Cleared progress for section item ${itemKey}`)
            console.log('This the progress now : ', state[itemKey])
          })
        }
        // Clearing module progress if provided
        if (update.modules) {
          update.modules.forEach((moduleId) => {
            const moduleKey = `${update.courseInstanceId}-${moduleId}`
            delete state[moduleKey] // Delete the progress state for each module
          })
        }
        // Clearing section progress if provided
        if (update.sections) {
          update.sections.forEach((sectionId) => {
            const sectionKey = `${update.courseInstanceId}-${sectionId}`
            delete state[sectionKey] // Delete the progress state for each section
          })
        }
      })
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      anotherApiService.endpoints.updateSectionItemProgress.matchFulfilled,
      (state, action) => {
        console.log('This is the payload : ', action.payload)
        action.payload.forEach((update) => {
          // Clear progress for each section item updated
          if (update.sectionItems) {
            update.sectionItems.forEach((item) => {
              const itemKey = `${update.courseInstanceId}-${item}`
              delete state[itemKey] // Delete the progress state for this section item
            })
          }
          // Additionally handle the updates for modules if provided
          if (update.modules) {
            update.modules.forEach((moduleId) => {
              const moduleKey = `${update.courseInstanceId}-${moduleId}`
              delete state[moduleKey] // Clear module progress
            })
          }
          // Additionally handle the updates for sections if provided
          if (update.sections) {
            update.sections.forEach((sectionId) => {
              const sectionKey = `${update.courseInstanceId}-${sectionId}`
              delete state[sectionKey] // Clear section progress
            })
          }
        })
      }
    )
  },
})

export const { clearProgress } = progressUpdateSlice.actions
export default progressUpdateSlice.reducer
