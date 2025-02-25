const Question = require('../../models/Course/SectionItems/QuestionSchema'); // Adjust the path to match where your models are stored

exports.createQuestion = async (req, res) => {
    try {
        const { questionText, options, answer, createdBy, assessmentId, type } = req.body;
        console.log('i am body',req.body);

        // Validate input data
        if (!questionText || !options || !answer || !createdBy || !assessmentId || !type) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Create a new question document
        const newQuestion = new Question({
            questionText,
            options,
            answer,
            createdBy,
            assessment: assessmentId,
            type
        });

        // Save the question to the database
        const savedQuestion = await newQuestion.save();

        // Successfully created
        res.status(201).json(savedQuestion);
    } catch (error) {
        // Handle errors
        res.status(500).json({ message: 'Server error', error });
    }
};
