import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

export async function createAttempt(req: Request, res: Response): Promise<void> {
  console.log("Original Request body:", req.body);
  const { assessmentId, courseInstanceId, studentId } = req.body;
  let attemptId = 1;

  try {
    const session2 = await prisma.submitSession.findFirst({
      where: {
        assessmentId: assessmentId,
        studentId: studentId,
      },
      select: {
        attemptId: true,
      },
    });

    if (session2) {
      console.log("Session:", session2.attemptId);
      attemptId = session2.attemptId + 1;
    } else {
      console.log("attempt Created")
      attemptId = 1;
    }

    res.status(201).json({ message: "Attempt created successfully", attemptId: attemptId });
  } catch (error) {
    console.error("Failed to create session:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).send({ message: `Error creating session: ${errorMessage}` });
  }
}
