import {CreateAttemptResponse} from '#quizzes/classes/validators/QuizValidator.js';

export function hideExplanationForStartAttempt(
  attempt: CreateAttemptResponse,
): CreateAttemptResponse {
  if (!attempt.questionRenderViews) {
    return attempt;
  }

  for (const question of attempt.questionRenderViews) {
    if (!('lotItems' in question)) continue;

    const lotItems = (question as any).lotItems;

    if (!Array.isArray(lotItems)) continue;

    for (const lotItem of lotItems) {
      if ('explaination' in lotItem) {
        delete lotItem.explaination;
      }
    }
  }

  return attempt;
}
