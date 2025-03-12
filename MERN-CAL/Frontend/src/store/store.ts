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
import usersSlicereducer from './slices/GetUsersSlice'

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
    'users',
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
  users: usersSlicereducer,
  [apiService.reducerPath]: apiService.reducer,
  [anotherApiService.reducerPath]: anotherApiService.reducer,
})

interface AppState {
  sidebarState: ReturnType<typeof sidebarStateReducer>
  items: ReturnType<typeof itemsReducer>
  auth: ReturnType<typeof authReducer>
  courses: ReturnType<typeof coursesReducer>
  modules: ReturnType<typeof modulesReducer>
  sections: ReturnType<typeof sectionsReducer>
  progress: ReturnType<typeof progressReducer>
  sectionProgress: ReturnType<typeof sectionProgressReducer>
  moduleProgress: ReturnType<typeof moduleProgressReducer>
  progressUpdate: ReturnType<typeof progressUpdateReducer>
  weeklyProgress: ReturnType<typeof weeklyProgressReducer>
  studentsProgress: ReturnType<typeof studentsProgressReducer>
  [apiService.reducerPath]: ReturnType<typeof apiService.reducer>
  [anotherApiService.reducerPath]: ReturnType<typeof anotherApiService.reducer>
}

const appReducer = (
  state: AppState | undefined,
  action: { type: string }
): AppState => {
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
