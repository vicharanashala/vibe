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
          Cookies.set('access_token', data.access_token, {
            secure: true,
            httpOnly: true,
          }) // Store the correct access token
          Cookies.set('user_id', data.user_id, { secure: true, httpOnly: true })
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
          Cookies.remove('access_token') // Remove the token after logout
        } catch (error) {
          console.error('Failed to remove access token from cookies', error)
        }
      },
    }),
  }),
})

// Export hooks for using the API endpoints
export const { useLoginMutation, useSignupMutation, useLogoutMutation } =
  apiService
