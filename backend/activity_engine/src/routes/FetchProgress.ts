import { Router } from "express";
import { getAllProgress } from "../controllers/ProgressController";
import { authenticateFirebaseUser } from "../Middleware/googleAuth";

const router = Router();

router.get("/all-progress", authenticateFirebaseUser, getAllProgress); // Fetch both student & average progress

export default router;
