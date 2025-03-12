const Question = require('../../models/Course/SectionItems/QuestionSchema'); // Adjust the path to match where your models are stored
const User = require('../../models/User/UserSchema'); 

exports.createQuestion = async (req, res) => {
    try {
        const { firebase_id } = req.user;
        const user = await User.findOne({ firebaseUid: firebase_id });
        const createdBy = user._id;
        const { questionText, options, answer, assessmentId, type } = req.body;
        console.log(createdBy)

        // Validate input data
        if (!questionText || !options || !answer || !assessmentId || !type) {
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
