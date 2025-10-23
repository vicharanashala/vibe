import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';

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
  userId: string | ObjectId;
  type: AnomalyType;
  courseId: string | ObjectId;
  versionId: string | ObjectId;
  itemId: string | ObjectId;
  fileName?: string;
  fileType?: FileType;
  createdAt: Date;

  constructor(data: Partial<IAnomalyData>, userId: string) {
    this.userId = new ObjectId(userId);
    this.type = data.type;
    this.courseId = new ObjectId(data.courseId);
    this.versionId = new ObjectId(data.versionId);
    this.itemId = new ObjectId(data.itemId);
    this.createdAt = new Date();
  }
}

export class AnomalyDataResponse extends IAnomalyData {
  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'URL of the file',
  })
  fileUrl: string;
}

export class AnomalyStats {
  @IsNumber()
  @JSONSchema({
    title: 'Number of voice detection anomalies',
    description: 'Number of voice detection anomalies',
  })
  VOICE_DETECTION: number;

  @IsNumber()
  @JSONSchema({
    title: 'Number of no face anomalies',
    description: 'Number of no face anomalies',
  })
  NO_FACE: number;

  @IsNumber()
  @JSONSchema({
    title: 'Number of multiple faces anomalies',
    description: 'Number of multiple faces anomalies',
  })
  MULTIPLE_FACES: number;

  @IsNumber()
  @JSONSchema({
    title: 'Number of blur detection anomalies',
    description: 'Number of blur detection anomalies',
  })
  BLUR_DETECTION: number;

  @IsNumber()
  @JSONSchema({
    title: 'Number of focus anomalies',
    description: 'Number of focus anomalies',
  })
  FOCUS: number;

  @IsNumber()
  @JSONSchema({
    title: 'Number of hand gesture detection anomalies',
    description: 'Number of hand gesture detection anomalies',
  })
  HAND_GESTURE_DETECTION: number;

  @IsNumber()
  @JSONSchema({
    title: 'Number of face recognition anomalies',
    description: 'Number of face recognition anomalies',
  })
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

export class PaginatedResponse<T> {

  data: T[];

 @IsNumber() 
  @JSONSchema({
    description: 'Current page number',
  })
  currentPage: number;
 @IsNumber() 
  @JSONSchema({
    description: 'Total number of documents',
  })
  totalDocuments: number;
 @IsNumber() 
  @JSONSchema({
    description: 'Total number of pages',
  })
  totalPages: number;
 @IsNumber() 
  limit: number;

  constructor(
    data: T[],
    currentPage: number,
    totalDocuments: number,
    limit: number,
  ) {
    this.data = data;
    this.currentPage = currentPage;
    this.totalDocuments = totalDocuments;
    this.limit = limit;
    this.totalPages = Math.ceil(totalDocuments / limit) || 1;
  }
}
