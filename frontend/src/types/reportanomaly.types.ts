// Types for AnomalyController

export enum AnomalyType {
  // NOTE: VOICE_DETECTION, HAND_GESTURE_DETECTION, and FACE_RECOGNITION below
  // have the same casing mismatch against the backend's AnomalyType enum
  // (backend uses 'VOICE_DETECTION', 'HAND_GESTURE_DETECTION', 'FACE_RECOGNITION')
  // and will fail the backend's @IsEnum validation the same way NO_FACE/
  // MULTIPLE_FACES did (see #1222). Left as-is here — out of scope for #1222,
  // tracked as a separate follow-up.
  VOICE_DETECTION = 'voiceDetection',
  // Fixed to match backend/src/modules/anomalies/classes/transformers/Anomaly.ts
  // (was 'no_face'/'multiple_faces' — backend's @IsEnum only accepts the
  // upper-snake-case values, so every NO_FACE/MULTIPLE_FACES report 400'd
  // before reaching the DB; confirmed live against the deployed backend).
  NO_FACE = 'NO_FACE',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
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

export interface NewAnomalyData {
  type: AnomalyType;
  courseId: string;
  versionId: string;
  itemId: string;
  cohortId?: string;
  /**
   * Average per-face detection confidence (0-1) for the frame that triggered
   * this report (#1222). Populated by public/workers/faceDetectorWorker.js via
   * @mediapipe/tasks-vision's FaceDetector, which exposes a real per-face
   * score (the previous @tensorflow-models/face-detection library did not).
   */
  confidence?: number;
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
