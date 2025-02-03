import { Router } from 'express';
import * as AssessmentGrading from '../controllers/AssessmentGrading';
import * as AssessmentSubmission from '../controllers/AssessmentSubmission';
import { authenticateFirebaseUser} from '../Middleware/googleAuth'

const router = Router();

router.post('/startAssessment', authenticateFirebaseUser, AssessmentGrading.createAttempt);
router.post('/submitAssessment', authenticateFirebaseUser, AssessmentSubmission.submitAssessment);

export default router;