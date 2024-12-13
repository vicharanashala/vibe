import { Request, Response, NextFunction } from 'express';
import { AnswersService } from '../../../services/answers.service';

const answersService = new AnswersService();

export class AnswersController {
  static async submitAnswers(req: Request, res: Response, next: NextFunction) {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      const { studentId, courseInstanceId, answers } = req.body;
      const result = await answersService.submitAnswers(attemptId, studentId, courseInstanceId, answers);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
