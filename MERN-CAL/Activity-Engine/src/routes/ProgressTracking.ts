import { Router } from 'express';
import { CourseProgressController } from '../controllers/CourseProgressController';
import { authenticateFirebaseUser} from '../Middleware/googleAuth'

const router = Router();

router.post("/course-progress/update-section-item-progress", CourseProgressController.updateSectionItemProgress);
router.post("/course-progress/initialize-progress", CourseProgressController.initializeProgressController);
router.get("/course-progress/course", CourseProgressController.getCourseProgress);
router.get("/course-progress/module", CourseProgressController.getModuleProgress);
router.get("/course-progress/section", CourseProgressController.getSectionProgress);
router.get("/course-progress/section-item", CourseProgressController.getSectionItemProgress);

export default router;
