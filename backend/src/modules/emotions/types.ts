export type EmotionType = "very_sad" | "sad" | "neutral" | "happy" | "very_happy";

export interface IEmotionSubmission {
  _id?: string;
  studentId: string;
  courseId: string;
  courseVersionId: string;
  itemId: string;
  emotion: EmotionType;
  feedbackText?: string;
  timestamp?: Date;
  cohortId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEmotionStats {
  itemId: string;
  emotion: EmotionType;
  count: number;
  percentage: number;
}

export interface IEmotionResponse {
  success: boolean;
  message?: string;
  data?: IEmotionSubmission;
}

const TYPES = {
  EmotionService: Symbol.for("EmotionService"),
  EmotionRepository: Symbol.for("EmotionRepository"),
};

export { TYPES as EMOTIONS_TYPES };
