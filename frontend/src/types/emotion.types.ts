export type EmotionType = "very_sad" | "sad" | "neutral" | "happy" | "very_happy";

export interface EmotionSubmission {
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

export interface EmotionDistribution {
  very_sad: number;
  sad: number;
  neutral: number;
  happy: number;
  very_happy: number;
}

export interface ModuleEmotionItemReport {
  itemId: string;
  itemName: string;
  itemType?: string;
  itemOrder?: string;
  total: number;
  distribution: EmotionDistribution;
  percentages: EmotionDistribution;
  averageSentiment: number;
  feedbackCount: number;
  feedbackEntries: Array<{
    submissionId?: string;
    emotion: EmotionType;
    feedbackText: string;
    timestamp?: string | Date;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  }>;
}

export interface ModuleEmotionReport {
  moduleId: string;
  moduleOrder?: number;
  moduleName: string;
  total: number;
  itemCount: number;
  distribution: EmotionDistribution;
  percentages: EmotionDistribution;
  averageSentiment: number;
  items: ModuleEmotionItemReport[];
}

export interface CourseEmotionReport {
  total: number;
  distribution: EmotionDistribution;
  percentages: EmotionDistribution;
  averageSentiment: number;
  modules: ModuleEmotionReport[];
}
