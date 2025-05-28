import {OTLQuestion} from 'modules/quizzes/classes/transformers';
import {IGrader} from './interfaces/IGrader';
import {
  IOTLAnswer,
  IQuestionAnswerFeedback,
} from 'modules/quizzes/interfaces/grading';
import {QuizItem} from 'modules/courses';
import {ILotOrder} from 'shared/interfaces/quiz';

// class OTLGrader implements IGrader {
//     constructor() {}

//     async grade(question: OTLQuestion, answer: IOTLAnswer, quiz: QuizItem): Promise<IQuestionAnswerFeedback> {
//         if (quiz.details.allowPartialGrading) {

//         } else {

//         }

//     }
// }
