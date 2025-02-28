import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

/**
 * Scheduled Job: Calculate and Store Total Course Progress for All Students
 */
export async function calculateTotalProgressForAllStudents() {
  console.log("Running scheduled job: Calculating total course progress for all students...");

  try {
    // Fetch all unique students with section item progress
    const students = await prisma.studentSectionItemProgress.findMany({
      select: { studentId: true },
      distinct: ["studentId"],
    });

    if (!students.length) {
      console.log("No students found with section item progress.");
      return;
    }

    // Mapping progress states to numerical values
    const progressMapping: Record<string, number> = {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      COMPLETE: 100,
    };

    // Iterate over each student and calculate total progress
    for (const { studentId } of students) {
      const progressSectionItem = await prisma.studentSectionItemProgress.findMany({
        where: { studentId },
        select: {
          courseInstanceId: true,
          progress: true,
        },
      });

      // Aggregate all section item progress under each course
      const courseProgressMap: Record<string, number[]> = {};

      progressSectionItem.forEach(({ courseInstanceId, progress }) => {
        if (!courseProgressMap[courseInstanceId]) {
          courseProgressMap[courseInstanceId] = [];
        }
        courseProgressMap[courseInstanceId].push(progressMapping[progress] ?? 0);
      });

      // Compute final total progress for each course based only on section items
      const courseTotalProgress = Object.entries(courseProgressMap).map(([courseInstanceId, progressList]) => ({
        studentId,
        courseInstanceId,
        progress: progressList.length > 0 ? Math.round(progressList.reduce((sum, val) => sum + val, 0) / progressList.length) : 0, // Rounded progress
      }));

      // Store or update progress in the `TotalProgress` table (keep only last 7 days)
      for (const progress of courseTotalProgress) {
        // Get the start and end time of the current day
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Check if an entry already exists for this student, course, and today
        const existingProgress = await prisma.totalProgress.findFirst({
          where: {
            studentId: progress.studentId,
            courseInstanceId: progress.courseInstanceId,
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        if (existingProgress) {
          // Update the existing record for today
          await prisma.totalProgress.update({
            where: { id: existingProgress.id },
            data: {
              progress: progress.progress,
              createdAt: new Date(), // Optional: Update the timestamp
            },
          });

          console.log(`Updated today's total progress for student ${progress.studentId} in course ${progress.courseInstanceId}`);
        } else {
          // Create a new record if none exists for today
          await prisma.totalProgress.create({
            data: {
              studentId: progress.studentId,
              courseInstanceId: progress.courseInstanceId,
              progress: progress.progress,
              createdAt: new Date(),
            },
          });

          console.log(`Created new total progress for student ${progress.studentId} in course ${progress.courseInstanceId}`);
        }
      }
    }

    console.log("Successfully calculated and stored total course progress for all students.");

    // Remove records older than 7 days
    await prisma.totalProgress.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Older than 7 days
        },
      },
    });

    console.log("Deleted total progress records older than 7 days.");

    // Update average progress after computing total progress
    await calculateAverageProgress();

  } catch (error) {
    console.error("Error calculating total progress for all students:", error);
  }
}

/**
 * Function: Calculate and Store Average Course Progress
 */
async function calculateAverageProgress() {
  console.log("Calculating and storing average progress for courses...");

  try {
    // Get all course instances and their student progress
    const courseProgress = await prisma.totalProgress.groupBy({
      by: ["courseInstanceId"],
      _avg: {
        progress: true,
      },
    });

    for (const { courseInstanceId, _avg } of courseProgress) {
      if (_avg.progress !== null) {
        // Get the start and end time of the current day
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Check if an entry already exists for this course and today
        const existingEntry = await prisma.averageProgress.findFirst({
          where: {
            courseInstanceId,
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        if (existingEntry) {
          // Update existing record for today
          await prisma.averageProgress.update({
            where: { id: existingEntry.id },
            data: {
              progress: Math.round(_avg.progress),
              createdAt: new Date(), // Optional: Update the timestamp
            },
          });

          console.log(`Updated today's average progress for course ${courseInstanceId}`);
        } else {
          // Create new record if none exists for today
          await prisma.averageProgress.create({
            data: {
              courseInstanceId,
              progress: Math.round(_avg.progress),
              createdAt: new Date(),
            },
          });

          console.log(`Created new average progress for course ${courseInstanceId}`);
        }
      }
    }

    console.log("Successfully updated average progress for all courses.");
  } catch (error) {
    console.error("Error calculating average progress:", error);
  }
}
