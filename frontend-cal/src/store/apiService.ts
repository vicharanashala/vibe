import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import API_URL, { ACTIVITY_URL } from '../../constant'
import Cookies from 'js-cookie'

export interface AuthResponse {
  refresh_token: string
  access_token: string
  role: string
  email: string
  full_name: string
}

export interface Institute {
  id: number
  name: string
  // Add other properties as needed
}

export const apiService = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL, // Replace with your API base URL
  }),
  endpoints: (builder) => ({
    login: builder.mutation<
      AuthResponse,
      { username: string; password: string; client_id: string }
    >({
      query: (credentials) => ({
        url: '/auth/login/',
        method: 'POST',
        body: credentials,
      }),
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

    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/userLogout',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          await queryFulfilled
          Cookies.remove('access_token') // Remove the token after logout
        } catch (error) {
          console.error('Failed to remove access token from cookies', error)
        }
      },
    }),

    fetchInstitutesWithAuth: builder.query<{ institutes: Institute[] }, void>({
      query: () => ({
        url: '/institutes/',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    fetchUsersWithAuth: builder.query<
      { users: { id: number; name: string; email: string }[] },
      void
    >({
      query: () => ({
        url: '/users/',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    fetchVideoDetailsWithAuth: builder.query<
      { videoDetails: { id: number; title: string; url: string }[] },
      void
    >({
      query: () => ({
        url: '/videos/',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),

    createVideoDetails: builder.mutation({
      query: (videoData) => ({
        url: '/videos',
        method: 'POST',
        body: videoData,
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),
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
        url: '/course/courses/',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),
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
    fetchSectionsWithAuth: builder.query<
      { sections: { id: number; title: string; content: string }[] },
      { courseId: number; moduleId: number }
    >({
      query: ({ courseId, moduleId }) => ({
        url: `/course/sections/?course_id=${courseId}&module_id=${moduleId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
        },
      }),
    }),
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
    updateSectionItemProgress: builder.mutation<
      void,
      {
        courseInstanceId: string
        studentId: string
        sectionItemId: string
        cascade: true
      }
    >({
      query: (progressData) => ({
        url: '/course-progress/update-section-item-progress',
        method: 'POST',
        body: progressData,
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Content-Type': 'application/json',
        },
      }),
    }),
  }),
})

export const {
  useFetchItemsWithAuthQuery,
  useLoginMutation,
  useFetchAssessmentWithAuthQuery,
  useSignupMutation,
  useLogoutMutation,
  useFetchInstitutesWithAuthQuery,
  useFetchUsersWithAuthQuery,
  useFetchVideoDetailsWithAuthQuery,
  useCreateVideoDetailsMutation,
  useFetchCoursesWithAuthQuery,
  useFetchModulesWithAuthQuery,
  useFetchSectionsWithAuthQuery,
  useFetchQuestionsWithAuthQuery,
  useUpdateSectionItemProgressMutation,
} = apiService

const ANOTHER_API_URL = ACTIVITY_URL // Replace with your new API base URL

export const anotherApiService = createApi({
  reducerPath: 'anotherApi',
  baseQuery: fetchBaseQuery({
    baseUrl: ANOTHER_API_URL,
  }),
  endpoints: (builder) => ({
    startAssessment: builder.mutation<
      void,
      { courseInstanceId: string; assessmentId: string }
    >({
      query: (assessmentData) => ({
        url: '/assessment/start',
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
    submitAssessment: builder.mutation<
      void,
      {
        courseInstanceId: string
        assessmentId: string
        attemptId: string
        answers: {
          natAnswers: { questionId: string; value: string }[]
          mcqAnswers: { questionId: string; choiceId: string }[]
          msqAnswers: { questionId: string; choiceIds: string[] }[]
          descriptiveAnswers: { questionId: string; value: string }[]
        }
      }
    >({
      query: (submissionData) => ({
        url: '/assessment/submit',
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
  }),
})

export const { useStartAssessmentMutation, useSubmitAssessmentMutation } =
  anotherApiService
