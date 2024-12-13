import { Router } from 'express';
import attemptsRouter from './attempts.router';
import metricsRouter from './metrics.router';

const router = Router();

router.use('/attempts', attemptsRouter);
router.use('/metrics', metricsRouter);

export default router;
