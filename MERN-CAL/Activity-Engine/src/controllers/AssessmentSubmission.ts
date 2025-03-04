  import { PrismaClient } from "@prisma/client";
  import { Request, Response } from "express";
  import axios from "axios";
  import LMS_URL from "../contant";

  const prisma = new PrismaClient();

  export async function submitAssessment(
    req: Request,
    res: Response
  ): Promise<void> {
    const { studentId, courseId, assessmentId, attemptId, questionId, answers } = req.body;
    const authorization = req.headers.authorization;

    // Check if the authorization header is correctly formatted
    if (!authorization || !authorization.startsWith("Bearer ")) {
      res.status(401).send({ message: "Unauthorized" });
      return; // Early return to prevent further execution if unauthorized
    }

    // Extract the token from the Authorization header
    const idToken = authorization.split("Bearer ")[1];

    // Ensure answers is always an array
    const processedAnswers = Array.isArray(answers) ? answers : [answers];

    try {
      // Call the LMS API to get the correct answers
      const { data: solutionData } = await axios.get(`${LMS_URL}/api/questions/solution/?question_id=${questionId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      // Compare the provided answers with the correct answers
      const isCorrect = Array.isArray(solutionData.answer) &&
        processedAnswers.length === solutionData.answer.length &&
        processedAnswers.every(answer => solutionData.answer.includes(answer));

      // Check if there's an existing submission
      const existingSubmit = await prisma.submitSession.findFirst({
        where: { studentId, assessmentId }
      });

      let newSubmit;
      if (existingSubmit) {
        // Update the existing submission if it exists
        newSubmit = await prisma.submitSession.update({
          where: { id: existingSubmit.id },
          data: { courseId, attemptId, questionId, answers: processedAnswers, isAnswerCorrect: isCorrect },
        });
      } else {
        // Create a new submission if it does not exist
        newSubmit = await prisma.submitSession.create({
          data: { studentId, courseId, assessmentId, attemptId, questionId, answers: processedAnswers, isAnswerCorrect: isCorrect },
        });
      }

      // Send the submission data back to the client
      res.json(newSubmit);
    } catch (error) {
      console.error("Failed to submit assessment:", error);
      const errorMessage = (error as Error).message || 'Unknown error';
      res.status(500).send({
        message: `Error submitting assessment: ${errorMessage}`,
      });
    }
  }
