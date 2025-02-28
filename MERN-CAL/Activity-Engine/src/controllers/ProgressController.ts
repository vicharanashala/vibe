import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

/**
 * API: Get Student and Average Progress for Available Days
 * Requires: `studentId`
 */
export async function getAllProgress(req: Request, res: Response): Promise<void> {
  const { studentId } = req.query as { studentId: string };

  if (!studentId) {
    res.status(400).json({ message: "Missing studentId" });
    return;
  }

  try {
    // Fetch all student progress for the given student
    const studentProgressData = await prisma.totalProgress.findMany({
      where: { studentId },
      orderBy: { createdAt: "asc" }, // Order by date
    });

    // Fetch all average progress for all courses
    const averageProgressData = await prisma.averageProgress.findMany({
      orderBy: { createdAt: "asc" }, // Order by date
    });

    if (!studentProgressData.length && !averageProgressData.length) {
      res.status(404).json({ message: "No progress data found" });
      return;
    }

    // Group data by courseInstanceId with only available days
    const courseData: Record<string, { date: string; Average: number; User: number }[]> = {};

    studentProgressData.forEach((studentProgress) => {
      const { courseInstanceId, progress, createdAt } = studentProgress;

      const averageProgress = averageProgressData.find(
        (avg) => avg.courseInstanceId === courseInstanceId && avg.createdAt.toISOString().split("T")[0] === createdAt.toISOString().split("T")[0]
      );

      if (!courseData[courseInstanceId]) {
        courseData[courseInstanceId] = [];
      }

      // Push data only for days that exist in the database
      courseData[courseInstanceId].push({
        date: createdAt.toISOString().split("T")[0], // Format date as YYYY-MM-DD
        Average: averageProgress ? averageProgress.progress : 0,
        User: progress,
      });
    });

    res.status(200).json({
      courseData,
    });
  } catch (error) {
    console.error("Error retrieving progress data:", error);
    res.status(500).json({
      message: "Error retrieving progress data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
