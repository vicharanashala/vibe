import { ObjectId } from "mongodb";

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
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
}

export interface IValidationResult {
  isValid: boolean;
  error?: string;
  data?: any;
}

export interface IEncryptionResult {
  encryptedBuffer: Buffer;
  iv: string;
  algorithm: string;
}


export interface IDecryptionResult {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    decryptedImageBase64?: string;
    metadata: any;
    encryptionInfo: {
      hasEncryptedData: boolean;
      ivFormat: string;
      bufferSize?: number;
    };
  };
}

export class IAnomalyData {
    _id?: string | ObjectId;
    userId: string;
    type: AnomalyType;
    courseId: string;
    versionId: string;
    itemId: string;
    fileName?: string;
    fileType?: FileType;
    createdAt: Date;

    constructor(
      data: Partial<IAnomalyData>, 
      userId: string,
    ) {
        this.userId = userId;
        this.type = data.type;
        this.courseId = data.courseId;
        this.versionId = data.versionId;
        this.itemId = data.itemId;
        this.createdAt = new Date();
    }
}

export class AnomalyDataResponse extends IAnomalyData {
  fileUrl: string
}