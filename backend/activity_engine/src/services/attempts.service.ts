import { AttemptsRepository } from '../repositories/attempts.repository';

const attemptsRepo = new AttemptsRepository();

export class AttemptsService {
  async createAttempt(studentId: string, courseInstanceId: string, assessmentId: string) {
    // TODO: Potentially verify data from Django or trust it
    return attemptsRepo.createAttempt(studentId, courseInstanceId, assessmentId);
  }

  async getAttempt(attemptId: number) {
    return attemptsRepo.getAttempt(attemptId);
  }

  async submitAttempt(attemptId: number) {
    // TODO: Ensure the attempt is not already submitted, check conditions, etc.
    return attemptsRepo.submitAttempt(attemptId);
  }
}
