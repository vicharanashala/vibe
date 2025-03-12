const express = require('express');
const { getQuestionsByAssessmentId,getAnswerByQuestionId } = require('../../controllers/Questions/FetchQuestionsController');
const { createQuestion } = require('../../controllers/Questions/CreateQuestionsController');

const questionsRouter = express.Router();

questionsRouter.get('/question', getQuestionsByAssessmentId);
questionsRouter.get('/solution', getAnswerByQuestionId);
questionsRouter.post('/createQuestion', createQuestion);

module.exports = questionsRouter;
