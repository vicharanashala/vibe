import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { ACTIVITY_URL } from '../../../../constant'
import Cookies from 'js-cookie'

const ANOTHER_API_URL = ACTIVITY_URL

export const anotherApiService = createApi({
  reducerPath: 'anotherApi',
  baseQuery: fetchBaseQuery({
    baseUrl: ANOTHER_API_URL,
  }),
  endpoints: (builder) => ({
    // Start assessment endpoint
    startAssessment: builder.mutation<
      { attemptId: string },
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
      {
        id: number
        studentId: string
        courseId: string
        assessmentId: string
        attemptId: number
        questionId: string
        answers: string
        isAnswerCorrect: boolean
        createdAt: string
      },
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
  }),
})

// Export hooks for assessment endpoints
export const { useStartAssessmentMutation, useSubmitAssessmentMutation } =
  anotherApiService
