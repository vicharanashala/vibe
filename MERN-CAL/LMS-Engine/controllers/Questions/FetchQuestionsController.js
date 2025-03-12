const Question = require('../../models/Course/SectionItems/QuestionSchema'); // Adjust the path as necessary

// Fetch all questions with a specific assessment ID
exports.getQuestionsByAssessmentId = async (req, res) => {
    try {
        const assessmentId = req.query.assessment_id;
        const questions = await Question.find({ assessment: assessmentId });
        console.log(questions, 'assessment Id : ', assessmentId)

        if (!questions) {
            return res.status(404).json({ message: 'No questions found for this assessment ID' });
        }

        const questionsLength = questions.length;
        const randomIndex = Math.floor(Math.random() * questionsLength);

        const randomQuestion = questions[randomIndex];

        const responseData = [{
        id: randomQuestion._id,
        text: randomQuestion.questionText,
        type: randomQuestion.type,
        options: randomQuestion.options,
        time_limit: randomQuestion.timeLimit,
        assessment: randomQuestion.assessment,
        marks: randomQuestion.points,
        }];

        res.status(200).json(responseData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Fetch only the answer row from a question using question ID
exports.getAnswerByQuestionId = async (req, res) => {
    try {
        const  questionId  = req.query.question_id;
        
        const question = await Question.findById(questionId).select('answer');
        // const question = await Question.find({
        //             '_id': questionId
        //         }).select('answer');

        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }
        console.log(question)
        res.status(200).json(question);
    } catch (error) {
        console.error("Error fetching question:", error); // Log the error
        res.status(500).json({ message: 'Server error', error });
    }
};
