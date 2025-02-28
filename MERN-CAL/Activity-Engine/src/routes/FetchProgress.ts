import { Router } from "express";
import { getAllProgress } from "../controllers/ProgressController";
import { fetchAllStudentsAverageProgressWithDetails } from "../controllers/AllStudentsProgress";
import { authenticateFirebaseUser } from "../Middleware/googleAuth";

const router = Router();

router.get("/all-progress", authenticateFirebaseUser, getAllProgress); // Fetch both student & average progress
router.get("/all-students-progress", async (req, res) => {
    try {
        const studentProgress = await fetchAllStudentsAverageProgressWithDetails();
        res.json({ data: studentProgress });
    } catch (error) {
        console.error("Error fetching student progress:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

export default router;
