import { Router } from 'express';
import { CourseProgressController } from '../controllers/CourseProgressController';
import { authenticateFirebaseUser} from '../Middleware/googleAuth'

const router = Router();

router.post("/course-progress/update-section-item-progress", authenticateFirebaseUser, CourseProgressController.updateSectionItemProgress);
router.post("/course-progress/initialize-progress", CourseProgressController.initializeProgressController);
router.get("/course-progress/course", authenticateFirebaseUser, CourseProgressController.getCourseProgress);
router.get("/course-progress/module", authenticateFirebaseUser, CourseProgressController.getModuleProgress);
router.get("/course-progress/section", authenticateFirebaseUser, CourseProgressController.getSectionProgress);
router.get("/course-progress/section-item", authenticateFirebaseUser, CourseProgressController.getSectionItemProgress);

export default router; 
