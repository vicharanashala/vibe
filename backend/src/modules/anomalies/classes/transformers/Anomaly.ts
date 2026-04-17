import { ObjectId } from "mongodb";

export enum AnomalyType {
  VOICE_DETECTION = 'VOICE_DETECTION',
  NO_FACE = 'NO_FACE',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
  BLUR_DETECTION = 'BLUR_DETECTION',
  FOCUS = 'FOCUS',
  HAND_GESTURE_DETECTION = 'HAND_GESTURE_DETECTION',
  FACE_RECOGNITION = 'FACE_RECOGNITION',
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
  fileUrl?: string
}

export class AnomalyStats {
  VOICE_DETECTION: number;
  NO_FACE: number;
  MULTIPLE_FACES: number;
  BLUR_DETECTION: number;
  FOCUS: number;
  HAND_GESTURE_DETECTION: number;
  FACE_RECOGNITION: number;

  constructor() {
    this.VOICE_DETECTION = 0;
    this.NO_FACE = 0;
    this.MULTIPLE_FACES = 0;
    this.BLUR_DETECTION = 0;
    this.FOCUS = 0;
    this.HAND_GESTURE_DETECTION = 0;
    this.FACE_RECOGNITION = 0;
  }
}