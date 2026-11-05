import LearningCopilot from "@/app/pages/student/learning-copilot";

interface LearningCopilotPageProps {
  quizId?: string;
}

/**
 * Post-quiz entry point. The MVP renders the same Copilot experience that is
 * available from the student sidebar; quizId is kept in the API so live quiz
 * submission data can replace the seeded demo data without another UI change.
 */
export function LearningCopilotPage({ quizId: _quizId }: LearningCopilotPageProps) {
  return <LearningCopilot />;
}
