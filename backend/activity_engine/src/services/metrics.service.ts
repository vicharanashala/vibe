import { MetricsRepository } from '../repositories/metrics.repository';
import { ContentTypeEnum } from '@prisma/client';

const metricsRepo = new MetricsRepository();

export class MetricsService {
  async getVideoMetrics(studentId: string, courseInstanceId: string, videoId: string) {
    return metricsRepo.getVideoMetrics(studentId, courseInstanceId, videoId);
  }

  async updateVideoMetrics(studentId: string, courseInstanceId: string, videoId: string, replays: number) {
    return metricsRepo.updateVideoMetrics(studentId, courseInstanceId, videoId, replays);
  }

  async recordViolation(studentId: string, contentType: ContentTypeEnum, contentTypeId: string, violationType: string) {
    return metricsRepo.recordViolation(studentId, contentType, contentTypeId, violationType);
  }

  async getViolations(studentId: string, contentTypeId: string) {
    return metricsRepo.getViolations(studentId, contentTypeId);
  }
}
