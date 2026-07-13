// Types for AnomalyController

export enum AnomalyType {
  VOICE_DETECTION = 'voiceDetection',
  NO_FACE = 'no_face',
  MULTIPLE_FACES = 'multiple_faces',
  BLUR_DETECTION = 'BLUR_DETECTION',
  FOCUS = 'focus',
  HAND_GESTURE_DETECTION = 'handGestureDetection',
  FACE_RECOGNITION = 'faceRecognition',
  VIRTUAL_CAMERA = 'VIRTUAL_CAMERA',
}

export enum FileType {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
}

export interface ViolationMetadata {
  reason: string;
  durationMs?: number;
  consecutiveFrames?: number;
  signalStrength?: number;
  detectedAt: string;
}

export interface NewAnomalyData {
  type: AnomalyType;
  courseId: string;
  versionId: string;
  itemId: string;
  cohortId?: string;
  metadata?: ViolationMetadata;
}

export interface AnomalyData extends NewAnomalyData {
  _id?: string;
  userId: string;
  fileName?: string;
  fileType?: FileType;
  createdAt: string;
  cohortName?: string;
  metadata?: ViolationMetadata;
}

export interface GetCourseAnomalyParams {
  courseId: string;
  versionId: string;
}

export interface GetUserAnomalyParams extends GetCourseAnomalyParams {
  userId: string;
}

export interface AnomalyIdParams {
  id: string;
}

export interface DeleteAnomalyBody {
  courseId: string;
  versionId: string;
}
