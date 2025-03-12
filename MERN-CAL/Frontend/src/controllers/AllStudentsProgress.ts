import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Function: Fetch Latest Progress for All Students and Link with Firebase UID, Email, and Name
 */
export async function fetchAllStudentsAverageProgressWithDetails() {
    console.log("Fetching latest progress of all students with Firebase UID, email, and name...");

    try {
        // Fetch the latest progress entry per student per courseInstanceId and join with all_users & student_details
        const latestProgressEntries = await prisma.$queryRaw<
            { studentId: string; courseInstanceId: string; progress: number; firebase_uid: string; email: string; first_name: string; last_name: string;dept_name: string }[]
        >`
            WITH latest_progress AS (
                SELECT tp."studentId", tp."courseInstanceId", tp."progress", tp."createdAt",
                    ROW_NUMBER() OVER (PARTITION BY tp."studentId", tp."courseInstanceId" ORDER BY tp."createdAt" DESC) AS row_num
                FROM "TotalProgress" tp
            )
            SELECT lp."studentId", lp."courseInstanceId", lp."progress", 
                   u."firebase_uid", u."email",
                   sd."first_name", sd."last_name",
                   sd."dept_name"
            FROM latest_progress lp
            JOIN "all_users" u ON lp."studentId" = u."firebase_uid"
            JOIN "student_details" sd ON u."email" = sd."email"
            
            WHERE row_num = 1;
        `;

        // Organize progress data by studentId
        const studentProgressMap: Record<string, { firebaseUid: string; email: string; firstName: string; lastName: string; deptName: string; progressList: number[] }> = {};

        latestProgressEntries.forEach(({ studentId, progress, firebase_uid, email, first_name, last_name, dept_name }) => {
            if (!studentProgressMap[studentId]) {
                studentProgressMap[studentId] = { firebaseUid: firebase_uid, email, firstName: first_name, lastName: last_name, deptName: dept_name, progressList: [] };
            }
            studentProgressMap[studentId].progressList.push(progress);
        });

        // Compute the average progress for each student
        const studentAverages = Object.entries(studentProgressMap).map(([studentId, { firebaseUid, email, firstName, lastName, deptName, progressList }]) => ({
            studentId,
            firebaseUid,
            email,
            firstName,
            lastName,
            deptName,
            averageProgress: progressList.length > 0
                ? Math.round(progressList.reduce((sum, val) => sum + val, 0) / progressList.length)
                : 0, // Rounded progress
        }));

        console.log("Successfully fetched and calculated average progress with Firebase UID, email, and name.");
        return studentAverages;
    } catch (error) {
        console.error("Error fetching and calculating average progress with Firebase UID, email, and name:", error);
        return [];
    }
}
