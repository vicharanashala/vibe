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
    // Progress tracking endpoints

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
      keepUnusedDataFor: 86400,
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
      keepUnusedDataFor: 86400,
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
      keepUnusedDataFor: 86400,
    }),

    fetchSectionItemsProgress: builder.query<
      { progress: any },
      { courseInstanceId: string; sectionItemId: string }
    >({
      query: ({ courseInstanceId, sectionItemId }) => ({
        url: `/course-progress/section-item`,
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
      keepUnusedDataFor: 86400,
    }),
  }),
})

// Export hooks for assessment endpoints
export const {
  useFetchCourseProgressQuery,
  useFetchModuleProgressQuery,
  useFetchSectionProgressQuery,
  useFetchSectionItemsProgressQuery,
} = anotherApiService
