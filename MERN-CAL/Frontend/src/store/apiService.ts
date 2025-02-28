/**
 * API Service Configuration
 *
 * This file sets up the API services using Redux Toolkit Query for handling API requests.
 * It includes two main API services:
 * 1. apiService - For main application API endpoints
 * 2. anotherApiService - For assessment/activity related endpoints
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import API_URL, { ACTIVITY_URL } from '../../constant'
import Cookies from 'js-cookie'

// Response type for authentication endpoints
export interface AuthResponse {
  refresh_token: string
  access_token: string
  role: string
  email: string
  full_name: string
  firebase_uid: string
  user_id: string
}

// Institute data type
export interface Institute {
  id: number
  name: string
  // Add other properties as needed
}

// Main API service configuration
export const apiService = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL, // Replace with your API base URL
  }),
  endpoints: (builder) => ({
    // Authentication endpoints
    login: builder.mutation<
      AuthResponse,
      { email: string; password: string; client_id: string }
    >({
      query: (credentials) => ({
        url: '/auth/login/',
        method: 'POST',
        body: credentials,
      }),
      // Store authentication tokens in cookies after successful login
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled
          Cookies.set('access_token', data.access_token) // Store the correct access token
          Cookies.set('user_id', data.user_id)
        } catch (error) {
          console.error('Failed to store access token in cookies', error)
        }
      },
    }),

    // User registration endpoint
    signup: builder.mutation<
      AuthResponse,
      {
        first_name: string
        last_name: string
        email: string
        password: string
        role: string
      }
    >({
      query: (userData) => ({
        url: '/auth/signup/',
        method: 'POST',
        body: userData,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    }),

    // Logout endpoint
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout/',
        method: 'POST',
        body: {
          token: Cookies.get('access_token'),
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
      // Remove authentication tokens from cookies after logout
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          await queryFulfilled
        } catch (error) {
          // Log the error, but don't throw it
          console.error('Logout request failed:', error)
        } finally {
          // Always remove the token, regardless of the request outcome
          Cookies.remove('access_token')
          // Remove any other auth-related cookies if they exist
          Cookies.remove('refresh_token')
          // Add any other cookies that need to be removed
        }
      },
    }),

    // Course management endpoints
    fetchCoursesWithAuth: builder.query<
      {
        courses: {
          course_id: number
          name: string
          description: string
          visibility: string
          created_at: string
        }[]
      },
      void
    >({
      query: () => ({
        url: '/courses/course/',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    // Module management endpoints
    fetchModulesWithAuth: builder.query<{ modules: {}[] }, number>({
      query: (courseId) => ({
        url: `/course/modules/?course_id=${courseId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),

    // Assessment management endpoints
    fetchAssessmentWithAuth: builder.query<
      { assessment: { id: number; title: string; description: string } },
      number
    >({
      query: (assessmentId) => ({
        url: `/assessment/questions/${assessmentId}/`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    // Section management endpoints
    fetchSectionsWithAuth: builder.query<
      { sections: { id: number; title: string; content: string }[] },
      { courseId: number; moduleId: number }
    >({
      query: ({ moduleId }) => ({
        url: `/sections/section/?module_id=${moduleId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    // Item management endpoints
    fetchItemsWithAuth: builder.query<
      { items: { id: number; name: string; description: string }[] },
      number
    >({
      query: (sectionId) => ({
        url: `/course/items/?section_id=${sectionId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    // Question management endpoints
    fetchQuestionsWithAuth: builder.query<
      { items: { id: number; name: string; description: string }[] },
      number
    >({
      query: (assessmentId) => ({
        url: `/assessment/questions/?assessment_id=${assessmentId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),
    createQuestion: builder.mutation<void, void>({
      query: (questionData) => ({
        url: `/questions/createQuestion`,
        method: 'POST',
        body: questionData,
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),
    createCourse: builder.mutation<
      void,
      { title: string; description: string; startData: String; endDate: String }
    >({
      query: (courseData) => ({
        url: '/courses/course',
        method: 'POST',
        body: courseData,
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),
    createModule: builder.mutation<void, { courseId: number; title: string }>({
      query: (moduleData) => ({
        url: 'modules/module',
        method: 'POST',
        body: moduleData,
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),
    createSection: builder.mutation<
      void,
      { courseId: number; moduleId: number; title: string; content: string }
    >({
      query: (sectionData) => ({
        url: 'sections/section',
        method: 'POST',
        body: sectionData,
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),
    bulkContentUpload: builder.mutation<void, { content: any[] }>({
      query: (uploadData) => ({
        url: '/sectionitems/bulkUpload',
        method: 'POST',
        body: uploadData,
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),
    fetchUsers: builder.query<
      { users: { id: number; name: string; email: string }[] },
      void
    >({
      query: () => ({
        url: '/users/getusers', // Make sure this endpoint is correct
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`, // Ensure the token is being retrieved correctly
        },
      }),
    }),
  }),
})

// Export hooks for using the API endpoints
export const {
  useFetchItemsWithAuthQuery,
  useFetchUsersQuery,
  useCreateCourseMutation,
  useCreateModuleMutation,
  useCreateSectionMutation,
  useBulkContentUploadMutation,
  useCreateQuestionMutation,
  useLoginMutation,
  useFetchAssessmentWithAuthQuery,
  useSignupMutation,
  useLogoutMutation,
  useFetchCoursesWithAuthQuery,
  useFetchModulesWithAuthQuery,
  useFetchSectionsWithAuthQuery,
  useFetchQuestionsWithAuthQuery,
} = apiService

const ANOTHER_API_URL = ACTIVITY_URL // Replace with your new API base URL

export const anotherApiService = createApi({
  reducerPath: 'anotherApi',
  baseQuery: fetchBaseQuery({
    baseUrl: ANOTHER_API_URL,
  }),
  endpoints: (builder) => ({
    // Start assessment endpoint
    startAssessment: builder.mutation<
      void,
      { courseInstanceId: string; assessmentId: string }
    >({
      query: (assessmentData) => ({
        url: '/startAssessment',
        method: 'POST',
        body: {
          ...assessmentData,
          studentId: Cookies.get('user_id'), // Get studentId from cookies
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled
          Cookies.set('attemptId', data.attemptId) // Store the correct access token
          Cookies.remove('gradingData')
        } catch (error) {
          console.error('Failed to store access token in cookies', error)
        }
      },
    }),

    // Submit assessment endpoint
    submitAssessment: builder.mutation<
      void,
      {
        assessmentId: number
        courseId: number
        attemptId: number
        answers: string
        questionId: number
      }
    >({
      query: (submissionData) => ({
        url: '/submitAssessment',
        method: 'POST',
        body: {
          ...submissionData,
          studentId: Cookies.get('user_id'), // Get studentId from cookies
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),
    // Progress tracking endpoints
    updateSectionItemProgress: builder.mutation<
      void,
      {
        courseInstanceId: string
        sectionItemId: string[]
        cascade: boolean
      }
    >({
      query: (progressData) => ({
        url: '/course-progress/update-section-item-progress',
        method: 'POST',
        body: {
          ...progressData,
          studentId: Cookies.get('user_id'), // Get studentId from cookies
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),

    fetchCourseProgress: builder.query<
      { progress: any },
      { courseInstanceId: string }
    >({
      query: ({ courseInstanceId }) => ({
        url: `/course-progress/course`,
        method: 'GET',
        params: {
          courseInstanceId,
          studentId: Cookies.get('user_id'), // Get studentId from cookies
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    fetchModuleProgress: builder.query<
      { progress: any },
      { courseInstanceId: string; moduleId: string }
    >({
      query: ({ courseInstanceId, moduleId }) => ({
        url: `/course-progress/module`,
        method: 'GET',
        params: {
          courseInstanceId,
          moduleId,
          studentId: Cookies.get('user_id'), // Get studentId from cookies
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    initailizeCourseProgress: builder.mutation<void>({
      query: (progressData) => ({
        url: '/course-progress/initialize-progress',
        method: 'POST',
        body: {
          ...progressData,
        },
      }),
    }),

    fetchSectionProgress: builder.query<
      { progress: any },
      { courseInstanceId: string; sectionId: string }
    >({
      query: ({ courseInstanceId, sectionId }) => ({
        url: `/course-progress/section`,
        method: 'GET',
        params: {
          courseInstanceId,
          sectionId,
          studentId: Cookies.get('user_id'), // Get studentId from cookies
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    fetchSectionItemsProgress: builder.query<
      { progress: any },
      { courseInstanceId: string; sectionItemId: string }
    >({
      query: ({ courseInstanceId, sectionItemId }) => ({
        url: `/course-progress/section-item
`,
        method: 'GET',
        params: {
          courseInstanceId,
          sectionItemId,
          studentId: Cookies.get('user_id'), // Get studentId from cookies
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),
    fetchWeeklyProgress: builder.query<void, void>({
      query: () => ({
        url: '/all-progress',
        method: 'GET',
        params: {
          studentId: Cookies.get('user_id'), // Get studentId from cookies
        },
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),
    fetchAllStudentsProgress: builder.query<void, void>({
      query: () => ({
        url: '/all-students-progress',
        method: 'GET',
      }),
    }),
  }),
})

// Export hooks for assessment endpoints
export const {
  useStartAssessmentMutation,
  useSubmitAssessmentMutation,
  useUpdateSectionItemProgressMutation,
  useFetchCourseProgressQuery,
  useFetchModuleProgressQuery,
  useFetchSectionProgressQuery,
  useFetchSectionItemsProgressQuery,
  useInitailizeCourseProgressMutation,
  useFetchWeeklyProgressQuery,
  useFetchAllStudentsProgressQuery,
} = anotherApiService
