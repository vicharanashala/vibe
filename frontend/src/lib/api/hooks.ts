import { api } from './openapi';
import { components } from './schema';
// import type { UseQueryMethod } from 'openapi-react-query';

// Auth hooks

// POST /auth/verify
export function useLogin() {
  return api.useQuery("post", "/auth/verify", {});
}

// POST /auth/signup
export function useSignup(signupData: components['schemas']['SignUpBody']) {
  const {data} = api.useQuery("post", "/auth/signup", {signupData} );
  return data;
}
// POST /auth/signup/verify
export function useVerifySignUpProvider(verifyData: components['schemas']['VerifySignUpProviderBody']) {
  return api.useQuery("post", "/auth/signup/verify", {verifyData}).data;
}

// PATCH /auth/change-password
export function useChangePassword(passwordData: Record<string, never>) {
  return api.useQuery("patch", "/auth/change-password", {passwordData}).data;
}

export function useCourses(id: string): unknown /*components['schemas']['CourseDataResponse'] | undefined */{
  // GET /courses/{id} (fetch course by id)

  return api.useQuery("get", "/courses/{id}", { params: { path: { id } } });
}

export function useCreateCourse() {
  // POST /courses/
  return api.useMutation("post", "/courses/");
}

// PATCH /users/{userId}/progress/courses/{courseId}/versions/{courseVersionId}/update
export function useUpdateCourseProgress() {
  return api.useMutation("patch", "/users/{userId}/progress/courses/{courseId}/versions/{courseVersionId}/update");
}