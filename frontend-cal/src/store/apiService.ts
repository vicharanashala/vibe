import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import API_URL from "../../constant";
import Cookies from "js-cookie";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

const mapStatus = (status: string): string => {
  return status;
};

export const apiService = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL, // Replace with your API base URL
  }),
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (credentials) => ({
        url: "/login/",
        method: "POST",
        body: credentials,
      }),
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          Cookies.set("access_token", data.token); // Store token after login
        } catch (error) {
          console.error("Failed to store access token in cookies", error);
        }
      },
    }),

    signup: builder.mutation<
      AuthResponse,
      { first_name: string; last_name: string; username: string; email: string; password: string; user_type: string }
    >({
      query: (userData) => ({
      url: "/register/",
      method: "POST",
      body: userData,
      }),
      onQueryStarted: async (arg, { queryFulfilled }) => {
      try {
        const { data } = await queryFulfilled;
        Cookies.set("access_token", data.token); // Store token after signup
      } catch (error) {
        console.error("Failed to store access token in cookies", error);
      }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/login/",  // Assuming your logout endpoint is still '/login/' as in your original code
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`, // Send the token for authentication
        },
      }),
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          await queryFulfilled;
          Cookies.remove("access_token"); // Remove the token from cookies after logout
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
          Authorization: `Bearer ${Cookies.get("access_token")}`, // Send token with request
        },
      }),
      transformResponse: (response: any) => {
        return {
          institutes: response.map((institute: any) => ({
            ...institute,
            status: mapStatus(institute.status),
          })),
        };
      },
    }),

    fetchUsersWithAuth: builder.query<{ users: any[] }, void>({
      query: () => ({
        url: "/login/",
        method: "GET",
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`, // Send token with request
        },
      }),
      transformResponse: (response: any) => {
        return {
          users: response.map((user: any) => ({
            ...user,
            status: mapStatus(user.status),
          })),
        };
      },
    }), 
    fetchVideoDetailsWithAuth: builder.query<{ videoDetails: any[] }, void>({
      query: () => ({
        url: "/videos/",
        method: "GET",
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`, // Send token with request
        },
      }),
      transformResponse: (response: any) => {
        return {
          videoDetails: response.map((videoDetails: any) => ({
            ...videoDetails,
            status: mapStatus(videoDetails.status),
          })),
        };
      },
    }),
    createVideoDetails: builder.mutation({
      query: (videoData) => ({
        url: "/videos", // Replace with your actual API endpoint
        method: "POST",
        body: videoData,
        headers: {
          Authorization: `Bearer ${Cookies.get("access_token")}`, // Include token if required
          "Content-Type": "application/json", // Ensure JSON data is sent
        },
      }),
    }),


  }),
});

export const { 
  useCreateVideoDetailsMutation,
  useFetchVideoDetailsWithAuthQuery,
  useFetchInstitutesWithAuthQuery, 
  useFetchUsersWithAuthQuery,
  useLoginMutation, 
  useSignupMutation, 
  useLogoutMutation 
} = apiService;
