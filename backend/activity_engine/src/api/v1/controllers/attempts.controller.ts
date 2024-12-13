import { Request, Response, NextFunction } from 'express';
import { AttemptsService } from '../../../services/attempts.service';

const attemptsService = new AttemptsService();

export class AttemptsController {
  static async createAttempt(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, courseInstanceId, assessmentId } = req.body;
      const attempt = await attemptsService.createAttempt(studentId, courseInstanceId, assessmentId);
      res.status(201).json(attempt);
    } catch (error) {
      next(error);
    }
  }

  static async getAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      const attempt = await attemptsService.getAttempt(attemptId);
      if (!attempt) {
        res.status(404).json({ error: "Attempt not found" });
        return;
      }
      res.json(attempt);
    } catch (error) {
      next(error);
    }
  }

  static async submitAttempt(req: Request, res: Response, next: NextFunction) {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      const updated = await attemptsService.submitAttempt(attemptId);
      res.json({ status: "submitted_for_grading", attempt: updated });
    } catch (error) {
      next(error);
    }
  }
}
