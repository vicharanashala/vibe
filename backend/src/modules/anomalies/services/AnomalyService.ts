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
import { AnomalyDataResponse, FileType, IAnomalyData } from '../classes/transformers/Anomaly.js';

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
    file: Express.Multer.File,
    fileType: FileType
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

      const fileName = await this.cloudStorageService.uploadAnomaly(
        file,
        userId,
        anomaly.type,
        anomaly.createdAt,
        file.mimetype
      );

      anomaly.fileName = fileName;
      anomaly.fileType = fileType;

      // Save to database
      const savedAnomaly = await this.anomalyRepository.createAnomaly(anomaly, session);
      if (!savedAnomaly) {
        throw new InternalServerError('Failed to save anomaly record');
      }

      savedAnomaly._id = savedAnomaly._id.toString();
      delete savedAnomaly.fileName;
      delete savedAnomaly.fileType;
      return savedAnomaly;
    });
  }

  async getUserAnomalies(userId: string, courseId: string, versionId: string): Promise<AnomalyData[]> {
    return await this._withTransaction(async (session) => {
      const anomaly = await this.anomalyRepository.getByUser(userId, courseId, versionId, session);

      if (!anomaly || anomaly.length === 0) {
        throw new NotFoundError('No anomalies found for this user in the specified course and version');
      }

      return anomaly.map((a) => {
        a._id = a._id.toString();
        delete a.fileName;
        delete a.fileType;
        return a;
      });
    });
  }

  async getCourseAnomalies(courseId: string, versionId: string): Promise<AnomalyData[]> {
    return this._withTransaction(async (session) => {
      const courseVersion = await this.courseRepo.readVersion(versionId);
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
          throw new NotFoundError('Course version not found');
      }

      const anomalies = await this.anomalyRepository.getAnomaliesByCourse(courseId, versionId, session);
      if (!anomalies || anomalies.length === 0) {
          throw new NotFoundError('No anomalies found for this course version');
      }

      return anomalies.map((a) => {
          a._id = a._id.toString();
          delete a.fileName;
          delete a.fileType;
          return a;
      });
    });
  }

  async getCourseItemAnomalies(courseId: string, versionId: string, itemId: string): Promise<AnomalyData[]> {
    return this._withTransaction(async (session) => {
      const courseVersion = await this.courseRepo.readVersion(versionId);
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
          throw new NotFoundError('Course version not found');
      }

      const anomalies = await this.anomalyRepository.getAnomaliesByItem(courseId, versionId, itemId, session);
      if (!anomalies || anomalies.length === 0) {
          throw new NotFoundError('No anomalies found for this course version');
      }

      return anomalies.map((a) => {
          a._id = a._id.toString();
          delete a.fileName;
          delete a.fileType;
          return a;
      });
    });
  }

  async getAnomalyStats(userId: string, courseId: string, versionId: string): Promise<any> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
        throw new NotFoundError('User not found');
    }
    const version = await this.courseRepo.readVersion(versionId);
    if (!version || version.courseId.toString() !== courseId) {
        throw new NotFoundError('Course version not found');
    }
    const anomalies = await this.anomalyRepository.getByUser(userId, courseId, versionId);

    // percentage of eahc anomaly type
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