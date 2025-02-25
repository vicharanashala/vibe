/**
 * API Service Configuration
 *
 * This file sets up the API services using Redux Toolkit Query for handling API requests.
 * It includes two main API services:
 * 1. apiService - For main application API endpoints
 * 2. anotherApiService - For assessment/activity related endpoints
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import API_URL from '../../../../constant'
import Cookies from 'js-cookie'

// Response type for authentication endpoints
export interface AuthResponse {
  refresh_token: string
  access_token: string
  role: string
  email: string
  full_name: string
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
        url: `/modules/module/?course_id=${courseId}`,
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
        url: `/sectionItems/sectionItem/?section_id=${sectionId}`,
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
        url: `/questions/question/?assessment_id=${assessmentId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${Cookies.get('access_token')}`,
          'Cache-Control': 'no-cache',
        },
      }),
    }),
  }),
})

// Export hooks for using the API endpoints
export const {
  useFetchItemsWithAuthQuery,
  useFetchAssessmentWithAuthQuery,
  useFetchCoursesWithAuthQuery,
  useFetchModulesWithAuthQuery,
  useFetchSectionsWithAuthQuery,
  useFetchQuestionsWithAuthQuery,
} = apiService
