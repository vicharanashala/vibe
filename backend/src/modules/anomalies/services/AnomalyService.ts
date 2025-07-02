import { injectable, inject } from 'inversify';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { AnomalyRepository } from '../repositories/providers/mongodb/AnomalyRepository.js';
import { CloudStorageService } from './CloudStorageService.js';
import { Anomaly } from '../classes/transformers/Anomaly.js';
import { CreateAnomalyBody } from '../classes/validators/AnomalyValidators.js';
import { IAnomalyRecord } from '#root/shared/interfaces/models.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { ANOMALIES_TYPES } from '../types.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';
import { IItemRepository } from '#root/shared/database/interfaces/IItemRepository.js';
import { NotFoundError } from 'routing-controllers';
import { COURSES_TYPES } from '#courses/types.js';

@injectable()
export class AnomalyService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.Database) db: MongoDatabase,
    @inject(ANOMALIES_TYPES.AnomalyRepository) private anomalyRepository: AnomalyRepository,
    @inject(ANOMALIES_TYPES.CloudStorageService) private cloudStorageService: CloudStorageService,
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private readonly courseRepo: ICourseRepository,
    @inject(COURSES_TYPES.ItemRepo) private readonly itemRepo: IItemRepository,
  ) {
    super(db);
  }

  async recordAnomaly(anomalyData: CreateAnomalyBody): Promise<Anomaly> {
    return this._withTransaction(async (session) => {
      const { userId, courseId, courseVersionId, moduleId, sectionId, itemId } = anomalyData;

      const user = await this.userRepo.findById(userId);
      if (!user) throw new NotFoundError('User not found');

      const course = await this.courseRepo.read(courseId, session);
      if (!course) throw new NotFoundError('Course not found');

      const courseVersion = await this.courseRepo.readVersion(courseVersionId, session);
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError('Course version not found or does not belong to this course');
      }

      const module = courseVersion.modules?.find(m => m.moduleId.toString() === moduleId);
      if (!module) throw new NotFoundError('Module not found in this course version');

      const section = module.sections?.find(s => s.sectionId.toString() === sectionId);
      if (!section) throw new NotFoundError('Section not found in this module');

      const itemsGroup = await this.itemRepo.readItemsGroup(section.itemsGroupId.toString(), session);
      if (!itemsGroup || !itemsGroup.items?.find(i => i._id.toString() === itemId)) {
        throw new NotFoundError('Item not found in this section');
      }
      
      // Upload compressed & encrypted image to cloud storage
      const timestamp = new Date();
      
      // Convert base64 to Buffer
      const base64Data = anomalyData.imageData.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      const { imageUrl, encryptedImageData, imageMetadata } = await this.cloudStorageService.uploadAnomalyImage(
        imageBuffer,
        anomalyData.userId,
        timestamp,
        anomalyData.anomalyType
      );

      // Create anomaly record
      const anomaly = new Anomaly({
        ...anomalyData,
        timestamp,
        imageUrl,
        encryptedImageData,
        imageMetadata,
      });

      // Save to database
      const savedAnomaly = await this.anomalyRepository.createAnomaly(anomaly, session);
      
      return savedAnomaly;
    });
  }

  async getUserAnomalies(userId: string, filters: Record<string, any>): Promise<IAnomalyRecord[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (filters.courseId) {
        const course = await this.courseRepo.read(filters.courseId);
        if (!course) throw new NotFoundError('Course specified in filters not found');
    }
    return await this.anomalyRepository.getAnomaliesByUser(userId, filters);
  }

  async getCourseAnomalies(courseId: string, userId?: string): Promise<IAnomalyRecord[]> {
    const course = await this.courseRepo.read(courseId);
    if (!course) {
        throw new NotFoundError('Course not found');
    }
    if (userId) {
        const user = await this.userRepo.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
    }
    return await this.anomalyRepository.getAnomaliesByCourse(courseId, userId);
  }

  async getAnomalyStats(userId: string, courseId?: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
        throw new NotFoundError('User not found');
    }
    if (courseId) {
        const course = await this.courseRepo.read(courseId);
        if (!course) {
            throw new NotFoundError('Course not found');
        }
    }
    return await this.anomalyRepository.getAnomalyStats(userId, courseId);
  }

  async deleteAnomaly(anomalyId: string): Promise<boolean> {
    return this._withTransaction(async (session) => {
      // Get anomaly to retrieve image URL for deletion
      const anomaly = await this.anomalyRepository.findAnomalyById(anomalyId);
      
      if (!anomaly) {
        throw new NotFoundError('Anomaly not found');
      }

      if (anomaly?.imageUrl) {
        // Delete encrypted image from cloud storage
        await this.cloudStorageService.deleteAnomalyImage(anomaly.imageUrl);
      }
      
      // Delete from database
      return await this.anomalyRepository.deleteAnomaly(anomalyId, session);
    });
  }

  async findAnomalyById(anomalyId: string): Promise<IAnomalyRecord | null> {
    return await this.anomalyRepository.findAnomalyById(anomalyId);
  }
}