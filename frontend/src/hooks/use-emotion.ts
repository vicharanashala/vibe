import { useMutation, useQuery } from "@tanstack/react-query";
import { EmotionType, EmotionSubmission, EmotionResponse, CourseEmotionReport } from "@/types/emotion.types";
import { apiClient } from "@/lib/api-client";

interface SubmitEmotionPayload {
  courseId: string;
  courseVersionId: string;
  itemId: string;
  emotion: EmotionType;
  feedbackText?: string;
  cohortId?: string;
}

interface EmotionApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

function unwrapEmotionResponse<T>(response: EmotionApiResponse<T>, fallbackMessage: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || fallbackMessage);
  }

  return response.data;
}

async function submitEmotion(payload: SubmitEmotionPayload): Promise<EmotionResponse> {
  const response = await apiClient.post<EmotionApiResponse<EmotionSubmission>>("/emotions/submit", payload);
  const data = unwrapEmotionResponse(response.data, "Failed to submit emotion");

  return {
    success: true,
    data,
  };
}

export function useSubmitEmotion() {
  return useMutation({
    mutationFn: submitEmotion,
    onError: (error) => {
      console.error("Error submitting emotion:", error);
    },
  });
}

/**
 * Get emotion statistics for a specific item
 */
async function getEmotionStats(itemId: string) {
  const response = await apiClient.get<EmotionApiResponse<any[]>>(`/emotions/stats/${itemId}`);
  return unwrapEmotionResponse(response.data, "Failed to fetch emotion statistics");
}

export function useEmotionStats(itemId: string) {
  return useQuery({
    queryKey: ["emotionStats", itemId],
    queryFn: () => getEmotionStats(itemId),
    enabled: !!itemId,
  });
}

/**
 * Get learner's emotion history for a course
 */
async function getEmotionHistory(courseId: string, courseVersionId: string) {
  const response = await apiClient.get<EmotionApiResponse<EmotionSubmission[]>>(`/emotions/history/${courseId}/${courseVersionId}`);
  return unwrapEmotionResponse(response.data, "Failed to fetch emotion history");
}

export function useEmotionHistory(courseId: string, courseVersionId: string) {
  return useQuery({
    queryKey: ["emotionHistory", courseId, courseVersionId],
    queryFn: () => getEmotionHistory(courseId, courseVersionId),
    enabled: !!courseId && !!courseVersionId,
  });
}

/**
 * Get course-level emotion report
 */
async function getCourseEmotionReport(courseId: string, courseVersionId: string): Promise<CourseEmotionReport> {
  const response = await apiClient.get<EmotionApiResponse<CourseEmotionReport>>(`/emotions/report/${courseId}/${courseVersionId}`);
  return unwrapEmotionResponse(response.data, "Failed to fetch course emotion report");
}

export function useCourseEmotionReport(courseId: string, courseVersionId: string) {
  return useQuery({
    queryKey: ["courseEmotionReport", courseId, courseVersionId],
    queryFn: () => getCourseEmotionReport(courseId, courseVersionId),
    enabled: !!courseId && !!courseVersionId,
  });
}
