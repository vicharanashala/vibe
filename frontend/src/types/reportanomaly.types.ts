// Types for AnomalyController

export enum AnomalyType {
  // Values must match the backend AnomalyType enum exactly (the backend also
  // tolerates the older camelCase spellings for already-deployed clients).
  VOICE_DETECTION = 'VOICE_DETECTION',
  NO_FACE = 'NO_FACE',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
  BLUR_DETECTION = 'BLUR_DETECTION',
  FOCUS = 'FOCUS',
  HAND_GESTURE_DETECTION = 'HAND_GESTURE_DETECTION',
  FACE_RECOGNITION = 'FACE_RECOGNITION',
  GAZE_AWAY = 'GAZE_AWAY',
  FOREIGN_OBJECT = 'FOREIGN_OBJECT',

  VIRTUAL_CAMERA = 'VIRTUAL_CAMERA',
}

export enum FileType {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
}

export interface NewAnomalyData {
  type: AnomalyType;
  courseId: string;
  versionId: string;
  itemId: string;
  cohortId?: string;
}

export interface AnomalyData extends NewAnomalyData {
  _id?: string;
  userId: string;
  fileName?: string;
  fileType?: FileType;
  createdAt: string;
  cohortName?: string;
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
