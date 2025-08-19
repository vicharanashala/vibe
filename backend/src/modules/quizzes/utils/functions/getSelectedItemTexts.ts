import {BaseQuestion} from '../../classes/index.js';
import {Answer} from '../../interfaces/grading.js';

export const getSelectedItemTexts = (
  question: BaseQuestion,
  answer: Answer,
) => {
  const selectedAnswerTexts = [];
  if (
    (question.type === 'SELECT_ONE_IN_LOT' ||
      question.type === 'SELECT_MANY_IN_LOT') &&
    'incorrectLotItems' in question
  ) {
    // Normalize correct items into an array
    const correctItems =
      question.type === 'SELECT_MANY_IN_LOT' &&
      'correctLotItems' in question &&
      Array.isArray(question.correctLotItems)
        ? question.correctLotItems || []
        : question.type === 'SELECT_ONE_IN_LOT' &&
          'correctLotItem' in question &&
          question.correctLotItem
        ? [question.correctLotItem]
        : [];

    // Merge incorrect + correct
    const questionLotItems = [
      ...(Array.isArray(question.incorrectLotItems)
        ? question.incorrectLotItems
        : []),
      ...correctItems,
    ];

    // Normalize selected IDs
    const selectedLotId =
      question.type === 'SELECT_MANY_IN_LOT' && 'lotItemIds' in answer
        ? answer.lotItemIds
        : question.type === 'SELECT_ONE_IN_LOT' && 'lotItemId' in answer
        ? [answer.lotItemId]
        : [];

    // Map selected IDs to texts
    questionLotItems.forEach(lot => {
      if (selectedLotId.includes(lot._id.toString())) {
        selectedAnswerTexts.push(lot.text);
      }
    });
  }

  return selectedAnswerTexts;
};
