export type EmotionType = "very_sad" | "sad" | "neutral" | "happy" | "very_happy";

export interface EmotionSubmission {
  _id?: string;
  studentId: string;
  courseId: string;
  courseVersionId: string;
  itemId: string;
  emotion: EmotionType;
  timestamp?: Date;
  cohortId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EmotionResponse {
  success: boolean;
  message?: string;
  data?: EmotionSubmission;
}

export interface EmotionStats {
  itemId: string;
  emotion: EmotionType;
  count: number;
  percentage: number;
}
