import { AnswersRepository } from '../repositories/answers.repository';

const answersRepo = new AnswersRepository();

interface AnswerData {
  questionId: string;
  type: 'NAT' | 'DESCRIPTIVE' | 'MCQ' | 'MSQ';
  value?: string;
  choiceId?: string;
  choiceIds?: string[];
  answerText?: string;
}

export class AnswersService {
  async submitAnswers(attemptId: number, studentId: string, courseInstanceId: string, answers: AnswerData[]) {
    // You can add validation or calls to Django here to ensure the question exists
    for (const ans of answers) {
      switch (ans.type) {
        case 'NAT':
          if (!ans.value) throw new Error("value required for NAT");
          await answersRepo.createNATAnswer(attemptId, studentId, courseInstanceId, ans.questionId, ans.value);
          break;
        case 'DESCRIPTIVE':
          if (!ans.answerText) throw new Error("answerText required for DESCRIPTIVE");
          await answersRepo.createDescriptiveAnswer(attemptId, studentId, courseInstanceId, ans.questionId, ans.answerText);
          break;
        case 'MCQ':
          if (!ans.choiceId) throw new Error("choiceId required for MCQ");
          await answersRepo.createMCQAnswer(attemptId, studentId, courseInstanceId, ans.questionId, ans.choiceId);
          break;
        case 'MSQ':
          if (!ans.choiceIds || ans.choiceIds.length === 0) throw new Error("choiceIds required for MSQ");
          await answersRepo.createMSQAnswers(attemptId, studentId, courseInstanceId, ans.questionId, ans.choiceIds);
          break;
      }
    }
    return { status: 'answers_submitted' };
  }
}
