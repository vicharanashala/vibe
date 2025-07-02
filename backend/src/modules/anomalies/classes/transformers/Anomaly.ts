import {
  ObjectIdToString,
  StringToObjectId,
  ID,
  IAnomalyRecord,
} from '#shared/index.js';
import { Expose, Transform } from 'class-transformer';
import { ObjectId } from 'mongodb';

@Expose()
export class Anomaly implements IAnomalyRecord {
  @Expose({ toClassOnly: true })
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  userId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  courseId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  courseVersionId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  moduleId?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  sectionId?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  itemId?: ID;

  @Expose()
  timestamp: Date;

  @Expose()
  anomalyType: "multiple_faces" | "no_face" | "focus" | "blurDetection" | "voiceDetection" | "faceRecognition" | "handGestureDetection";

  @Expose()
  penaltyPoints: number;

  @Expose()
  imageUrl: string;

  @Expose()
  encryptedImageData: string;

  @Expose()
  imageMetadata: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    width: number;
    height: number;
    captureTimestamp: number;
  };

  @Expose()
  facesDetected: number;

  @Expose()
  sessionMetadata: {
    sessionId?: string;
    examId?: string;
    browserInfo?: string;
    userAgent?: string;
  };

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(anomalyData: any) {
    this.userId = new ObjectId(anomalyData.userId);
    this.courseId = new ObjectId(anomalyData.courseId);
    this.courseVersionId = new ObjectId(anomalyData.courseVersionId);
    if (anomalyData.moduleId) this.moduleId = new ObjectId(anomalyData.moduleId);
    if (anomalyData.sectionId) this.sectionId = new ObjectId(anomalyData.sectionId);
    if (anomalyData.itemId) this.itemId = new ObjectId(anomalyData.itemId);
    this.timestamp = anomalyData.timestamp || new Date();
    this.anomalyType = anomalyData.anomalyType;
    this.penaltyPoints = anomalyData.penaltyPoints;
    this.imageUrl = anomalyData.imageUrl || '';
    this.encryptedImageData = anomalyData.encryptedImageData || '';
    this.imageMetadata = anomalyData.imageMetadata || {};
    this.facesDetected = anomalyData.facesDetected;
    this.sessionMetadata = anomalyData.sessionMetadata || {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}