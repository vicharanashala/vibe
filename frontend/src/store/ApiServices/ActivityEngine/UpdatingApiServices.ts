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
  }),
})

// Export hooks for assessment endpoints
// Export hooks for the updateSectionItemProgress mutation
export const { useUpdateSectionItemProgressMutation } = anotherApiService

// Example data structure for section items progress
/*
  [
    {
      "course": null,
      "modules": null,
      "sections": null,
      "sectionItems": [
        "v7",
        "a7"
      ]
    },
    {
      "course": null,
      "modules": null,
      "sections": null,
      "sectionItems": [
        "a7",
        "v8"
      ]
    }
  ]

  [
    {
        "course": null,
        "modules": null,
        "sections": null,
        "sectionItems": [
            "v8",
            "a8"
        ]
    },
    {
        "course": "1",
        "modules": [
            "1"
        ],
        "sections": [
            "1"
        ],
        "sectionItems": [
            "a8"
        ]
    }
]
  */
