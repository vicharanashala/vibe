import { Router } from 'express';
import { authenticateFirebaseUser} from '../Middleware/googleAuth'
import {calculateTotalProgressForAllStudents} from '../controllers/TotalProgressController';

const router = Router();

router.get('/average-progress',calculateTotalProgressForAllStudents);

export default router;