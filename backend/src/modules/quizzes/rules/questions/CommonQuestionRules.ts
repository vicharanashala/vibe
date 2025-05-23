import {BaseQuestion} from '../../classes/transformers';

export class CommonQuestionRules {
  static validate(question: BaseQuestion): void {
    if (!question.text?.trim()) {
      throw new Error('Question text cannot be empty.');
    }
    if (question.points <= 0) {
      throw new Error('Points must be greater than zero.');
    }
    if (question.timeLimitSeconds < 10) {
      throw new Error('Time limit must be at least 10 seconds.');
    }
  }
}
