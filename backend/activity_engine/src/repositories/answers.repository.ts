import prisma from '../config/prisma';

export class AnswersRepository {
  async createNATAnswer(attemptId: number, studentId: string, courseInstanceId: string, questionId: string, value: string) {
    return prisma.studentNATAnswer.create({
      data: {
        assessmentAttemptId: attemptId,
        studentId,
        courseInstanceId,
        questionId,
        value
      }
    });
  }

  async createDescriptiveAnswer(attemptId: number, studentId: string, courseInstanceId: string, questionId: string, answerText: string) {
    return prisma.studentDescriptiveAnswer.create({
      data: {
        assessmentAttemptId: attemptId,
        studentId,
        courseInstanceId,
        questionId,
        answerText
      }
    });
  }

  async createMCQAnswer(attemptId: number, studentId: string, courseInstanceId: string, questionId: string, choiceId: string) {
    return prisma.studentMCQAnswer.create({
      data: {
        assessmentAttemptId: attemptId,
        studentId,
        courseInstanceId,
        questionId,
        choiceId
      }
    });
  }

  async createMSQAnswers(attemptId: number, studentId: string, courseInstanceId: string, questionId: string, choiceIds: string[]) {
    const data = choiceIds.map(choiceId => ({
      assessmentAttemptId: attemptId,
      studentId,
      courseInstanceId,
      questionId,
      choiceId
    }));
    return prisma.studentMSQAnswer.createMany({ data });
  }
}
