import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import API_URL from "../../constant";
import Cookies from "js-cookie";

export interface AuthResponse {
  refresh: string;
  access: string;
  role: string;
  email: string;
  full_name: string;
}

export const apiService = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL, // Replace with your API base URL
  }),
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { username: string; password: string }>({
      query: (credentials) => ({
        url: "/auth/login/",
        method: "POST",
        body: credentials,
      }),
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          Cookies.set("access_token", data.access); // Store the correct access token
        } catch (error) {
          console.error("Failed to store access token in cookies", error);
        }
      },
    }),

    signup: builder.mutation<AuthResponse, { first_name: string; last_name: string; username: string; email: string; password: string }>({
      query: (userData) => ({
        url: "/auth/register/",
        method: "POST",
        body: userData,
      }),
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          Cookies.set("access_token", data.access); // Optionally store the token here too
        } catch (error) {
          console.error("Signup failed", error);
        }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/login/",
        method: "POST",
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`,
        },
      }),
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          await queryFulfilled;
          Cookies.remove("access_token"); // Remove the token after logout
        } catch (error) {
          console.error("Failed to remove access token from cookies", error);
        }
      },
    }),

    fetchInstitutesWithAuth: builder.query<{ institutes: any[] }, void>({
      query: () => ({
        url: "/institutes/",
        method: "GET",
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`,
        },
      }),
    }),

    fetchUsersWithAuth: builder.query<{ users: any[] }, void>({
      query: () => ({
        url: "/users/",
        method: "GET",
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`,
        },
      }),
    }),

    fetchVideoDetailsWithAuth: builder.query<{ videoDetails: any[] }, void>({
      query: () => ({
        url: "/videos/",
        method: "GET",
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`,
        },
      }),
    }),

    createVideoDetails: builder.mutation({
      query: (videoData) => ({
        url: "/videos",
        method: "POST",
        body: videoData,
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`,
          "Content-Type": "application/json",
        },
      }),
    }),
    fetchCoursesWithAuth: builder.query<{ courses: any[] }, void>({
      query: () => ({
      url: "/course/courses/",
      method: "GET",
      headers: {
        Authorization: `Bearer ${Cookies.get("access_token")}`,
        "Content-Type": "application/json",
      },
      }),
    }),
    fetchModulesWithAuth: builder.query<{ modules: any[] }, number>({
      query: (courseId) => ({
        url: `/course/courses/${courseId}/`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`,
          "Content-Type": "application/json",
        },
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useLogoutMutation,
  useFetchInstitutesWithAuthQuery,
  useFetchUsersWithAuthQuery,
  useFetchVideoDetailsWithAuthQuery,
  useCreateVideoDetailsMutation,
  useFetchCoursesWithAuthQuery,
  useFetchModulesWithAuthQuery,
} = apiService;
