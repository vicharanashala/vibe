import { Router } from 'express';
import { MetricsController } from '../controllers/metrics.controller';

const router = Router();

router.get('/video', MetricsController.getVideoMetrics);
router.post('/video', MetricsController.updateVideoMetrics);
router.get('/violations', MetricsController.getViolations);
router.post('/violations', MetricsController.recordViolation);

export default router;
