import { injectable, inject } from 'inversify';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { AnomalyRepository } from '../repositories/providers/mongodb/AnomalyRepository.js';
import { CloudStorageService } from './CloudStorageService.js';
import { AnomalyData, NewAnomalyData } from '../classes/validators/AnomalyValidators.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { ANOMALIES_TYPES } from '../types.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { AnomalyDataResponse, AnomalyStats, AnomalyType, FileType, IAnomalyData, PaginatedResponse } from '../classes/transformers/Anomaly.js';

@injectable()
export class AnomalyService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.Database) db: MongoDatabase,
    @inject(ANOMALIES_TYPES.AnomalyRepository) private anomalyRepository: AnomalyRepository,
    @inject(ANOMALIES_TYPES.CloudStorageService) private cloudStorageService: CloudStorageService,
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private readonly courseRepo: ICourseRepository,
  ) {
    super(db);
  }

  async recordAnomaly(
    userId: string,
    anomalyData: NewAnomalyData,
    file?: Express.Multer.File,
    fileType?: FileType
  ): Promise<AnomalyData> {
    return this._withTransaction(async (session) => {
      const { courseId, versionId } = anomalyData;

      const courseVersion = await this.courseRepo.readVersion(versionId, session);
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError('Course version not found or does not belong to this course');
      }
      
      const anomaly = new IAnomalyData(
        anomalyData,
        userId
      );
      // For now the file and fileType are optional
      if(file && fileType){
        const fileName = await this.cloudStorageService.uploadAnomaly(
          file,
          userId,
          anomaly.type,
          anomaly.createdAt,
          file.mimetype
        );
        
        anomaly.fileName = fileName;
        anomaly.fileType = fileType;
      }

      // Save to database
      const savedAnomaly = await this.anomalyRepository.createAnomaly(anomaly, session);
      if (!savedAnomaly) {
        throw new InternalServerError('Failed to save anomaly record');
      }

      savedAnomaly._id = savedAnomaly._id.toString();
      if(file && fileType) {
      delete savedAnomaly.fileName;
      delete savedAnomaly.fileType;
      }
      return savedAnomaly;
    });
  }

  async getUserAnomalies(userId: string, courseId: string, versionId: string, limit: number, skip: number): Promise<AnomalyData[]> {
    return await this._withTransaction(async (session) => {
      const anomalies = await this.anomalyRepository.getByUser(userId, courseId, versionId, limit, skip, session);

      if (!anomalies || anomalies.length === 0) {
        throw new NotFoundError('No anomalies found for this user in the specified course and version');
      }

  
      const user = await this.userRepo.findById(userId);
      
      return anomalies.map((a) => ({
        ...a,
        _id: a._id.toString(),
        studentName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown User',
        studentEmail: user?.email || '',
        fileName: undefined,
        fileType: undefined
      } as unknown as AnomalyData));
    });
  }

  async getCourseAnomalies(
    courseId: string, 
    versionId: string, 
    limit: number, 
    skip: number,
    sortOptions?: { field: string; order: 'asc' | 'desc' },
    page: number = 1
  ): Promise<PaginatedResponse<AnomalyData>> {
    return this._withTransaction(async (session) => {
      const courseVersion = await this.courseRepo.readVersion(versionId);
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError('Course version not found');
      }

      const { data: anomalies, total } = await this.anomalyRepository.getAnomaliesByCourse(
        courseId, 
        versionId, 
        limit, 
        skip,
        sortOptions,
        session
      );

      if (!anomalies || anomalies.length === 0) {
        return new PaginatedResponse<AnomalyData>([], page, 0, limit);
      }

      const userIds = [...new Set(anomalies.map(a => a.userId))];
      const users = await this.userRepo.getUsersByIds(userIds);
      const userMap = new Map(users.map(user => [user._id.toString(), user]));

      const formattedAnomalies = anomalies.map((a) => {
        const user = userMap.get(a.userId);
        return {
          ...a,
          _id: a._id.toString(),
          studentName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown User',
          studentEmail: user?.email || '',
          fileName: undefined,
          fileType: undefined
        } as unknown as AnomalyData;
      });

      return new PaginatedResponse<AnomalyData>(formattedAnomalies, page, total, limit);
    });
  }

  async getCourseItemAnomalies(courseId: string, versionId: string, itemId: string, limit: number, skip: number): Promise<AnomalyData[]> {
    return this._withTransaction(async (session) => {
      const courseVersion = await this.courseRepo.readVersion(versionId);
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
          throw new NotFoundError('Course version not found');
      }

      const anomalies = await this.anomalyRepository.getAnomaliesByItem(courseId, versionId, itemId, limit, skip, session);
      if (!anomalies || anomalies.length === 0) {
          throw new NotFoundError('No anomalies found for this course version');
      }

      const userIds = [...new Set(anomalies.map(a => a.userId))];
      const users = await this.userRepo.getUsersByIds(userIds);
      const userMap = new Map(users.map(user => [user._id.toString(), user]));

      return anomalies.map((a) => {
          const user = userMap.get(a.userId);
          return {
              ...a,
              _id: a._id.toString(),
              studentName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown User',
              studentEmail: user?.email || '',
              fileName: undefined,
              fileType: undefined
          } as unknown as AnomalyData;
      });
    });
  }

  async getAnomalyStats(courseId: string, versionId: string, itemId?: string, userId?: string): Promise<AnomalyStats> {
    return this._withTransaction(async (session) => {
      const version = await this.courseRepo.readVersion(versionId);
      if (!version || version.courseId.toString() !== courseId) {
          throw new NotFoundError('Course version not found');
      }
      const anomalies = await this.anomalyRepository.getCustomAnomalies(courseId, versionId, itemId, userId, session);
      const stats = new AnomalyStats();
      anomalies.forEach((anomaly) => {
        switch (anomaly.type) {
          case AnomalyType.VOICE_DETECTION:
            stats.VOICE_DETECTION++;
            break;
          case AnomalyType.NO_FACE:
            stats.NO_FACE++;
            break;
          case AnomalyType.MULTIPLE_FACES:
            stats.MULTIPLE_FACES++;
            break;
          case AnomalyType.BLUR_DETECTION:
            stats.BLUR_DETECTION++;
            break;
          case AnomalyType.FOCUS:
            stats.FOCUS++;
            break;
          case AnomalyType.HAND_GESTURE_DETECTION:
            stats.HAND_GESTURE_DETECTION++;
            break;
          case AnomalyType.FACE_RECOGNITION:
            stats.FACE_RECOGNITION++;
            break;
        }
      });
      return stats;
    });
  }

  async deleteAnomaly(anomalyId: string, courseId: string, versionId: string): Promise<void> {
    return this._withTransaction(async (session) => {
      const anomaly = await this.anomalyRepository.getById(anomalyId, courseId, versionId, session);

      // Delete from database
      const result = await this.anomalyRepository.deleteAnomaly(anomalyId, courseId, versionId, session);

      if (!result) {
        throw new NotFoundError('Anomaly not found or could not be deleted');
      }

      // Delete from cloud storage
      if (anomaly.fileName) {
        await this.cloudStorageService.deleteAnomaly(anomaly.fileName);
      }
    });
  }

  async findAnomalyById(anomalyId: string, courseId: string, versionId: string): Promise<AnomalyDataResponse> {
    const result =  await this.anomalyRepository.getById(anomalyId, courseId, versionId);
    if (!result) {
      throw new NotFoundError('Anomaly not found');
    }
    //download and decrypt
    const fileUrl = await this.cloudStorageService.getSignedUrl(result.fileName);
    delete result.fileName;
    result._id = result._id.toString();
    return { ...result, fileUrl };
  }
}