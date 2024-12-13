import prisma from '../config/prisma';
import { AssessmentAttemptStatusEnum } from '@prisma/client';
 
export class AttemptsRepository {
  async createAttempt(studentId: string, courseInstanceId: string, assessmentId: string) {
    // Insert a new attempt history record
    return prisma.studentAssessmentAttemptHistory.create({
      data: {
        studentId,
        courseInstanceId,
        assessmentId,
        attemptTime: new Date(),
        status: AssessmentAttemptStatusEnum.IN_PROGRESS
      }
    });
  }
 
  async getAttempt(attemptId: number) {
    return prisma.studentAssessmentAttemptHistory.findUnique({
      where: { attemptId: attemptId },
      include: {
        natAnswers: true,
        descriptiveAnswers: true,
        mcqAnswers: true,
        msqAnswers: true
      }
    });
  }
 
  async submitAttempt(attemptId: number) {
    return prisma.studentAssessmentAttemptHistory.update({
      where: { attemptId: attemptId },
      data: {
        status: AssessmentAttemptStatusEnum.SUBMITTED,
        submissionTime: new Date()
      }
    });
  }
 
}