export interface ReportAnomalyBody {
  courseId: string;
  courseVersionId: string;
  moduleId?: string;
  sectionId?: string;
  itemId?: string;
  anomalyType: string;
}

export interface ReportAnomalyResponse {
  // Define the structure of the response here
  _id: string;
  userId: string;
  courseId: string;
  courseVersionId: string;
  moduleId?: string;
  sectionId?: string;
  itemId?: string;
  anomalyType: string;
}

export enum AnomalyType {
  VOICE_DETECTION = 'voiceDetection',
  NO_FACE = 'no_face',
  MULTIPLE_FACES = 'multiple_faces',
  BLUR_DETECTION = 'blurDetection',
  FOCUS = 'focus',
  HAND_GESTURE_DETECTION = 'handGestureDetection',
  FACE_RECOGNITION = 'faceRecognition',
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
}

export interface AnomalyData extends NewAnomalyData {
  _id?: string;
  userId: string;
  fileName?: string;
  fileType?: FileType;
  createdAt: string;
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