import { Router } from 'express';
import { AttemptsController } from '../controllers/attempts.controller';
import { AnswersController } from '../controllers/answers.controller';

const router = Router();

router.post('/', AttemptsController.createAttempt);
router.get('/:attemptId', AttemptsController.getAttempt);
router.post('/:attemptId/submit', AttemptsController.submitAttempt);
router.post('/:attemptId/answers', AnswersController.submitAnswers);

export default router;
