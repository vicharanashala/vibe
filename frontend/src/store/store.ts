// store.ts
import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import { apiService, anotherApiService } from './apiService'
import authReducer from './slices/authSlice'
import coursesReducer from './slices/courseSlice'
import modulesReducer from './slices/fetchModulesSlice'
import sectionsReducer from './slices/fetchSections'
import progressReducer from './slices/fetchStatusSlice'
import sectionProgressReducer from './slices/sectionProgressSlice'
import moduleProgressReducer from './slices/moduleProgressSlice'
import progressUpdateReducer from './slices/updateProgressSlice'
import sidebarStateReducer from './slices/sidebarSlice'
import studentsProgressReducer from './slices/AllStudentsProgressSlice'
import itemsReducer from './slices/fetchItems'
import weeklyProgressReducer from './slices/FetchWeeklyProgress'
import storageSession from 'redux-persist/lib/storage/session' // Importing sessionStorage

const persistConfig = {
  key: 'root',
  storage: storageSession,
  whitelist: [
    'auth',
    'courses',
    'modules',
    'progress',
    'sections',
    'sectionProgress',
    'moduleProgress',
    'items',
    'sidebarState',
    'weeklyProgress',
    'studentsProgress',
  ],
}

const rootReducer = combineReducers({
  sidebarState: sidebarStateReducer,
  items: itemsReducer,
  auth: authReducer,
  courses: coursesReducer,
  modules: modulesReducer,
  sections: sectionsReducer,
  progress: progressReducer,
  sectionProgress: sectionProgressReducer,
  moduleProgress: moduleProgressReducer,
  progressUpdate: progressUpdateReducer,
  weeklyProgress: weeklyProgressReducer,
  studentsProgress: studentsProgressReducer,
  [apiService.reducerPath]: apiService.reducer,
  [anotherApiService.reducerPath]: anotherApiService.reducer,
})

const appReducer = (state, action) => {
  if (action.type === 'auth/logoutState') {
    state = undefined // Resets state to undefined, triggering reinitialization to initialState
  }
  return rootReducer(state, action)
}

const persistedReducer = persistReducer(persistConfig, appReducer)

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    })
      .concat(apiService.middleware)
      .concat(anotherApiService.middleware),
})

export const persistor = persistStore(store)
export default store
