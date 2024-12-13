import prisma from '../config/prisma';
import { ContentTypeEnum } from '@prisma/client';

export class MetricsRepository {
  async getVideoMetrics(studentId: string, courseInstanceId: string, videoId: string) {
    return prisma.studentVideoMetrics.findUnique({
      where: {
        studentId_videoId_courseInstanceId: { 
          studentId, 
          videoId, 
          courseInstanceId
        }
      }
    });
  }

  async updateVideoMetrics(studentId: string, courseInstanceId: string, videoId: string, replays: number) {
    return prisma.studentVideoMetrics.upsert({
      where: {
        studentId_videoId_courseInstanceId: { studentId, videoId, courseInstanceId }
      },
      create: {
        studentId,
        courseInstanceId,
        videoId,
        replays
      },
      update: {
        replays
      }
    });
  }

  async recordViolation(studentId: string, contentType: ContentTypeEnum, contentTypeId: string, violationType: string) {
    return prisma.studentViolationMetrics.create({
      data: {
        studentId,
        contentType,
        contentTypeId,
        violationType
      }
    });
  }

  async getViolations(studentId: string, contentTypeId: string) {
    return prisma.studentViolationMetrics.findMany({
      where: { studentId, contentTypeId }
    });
  }
}
