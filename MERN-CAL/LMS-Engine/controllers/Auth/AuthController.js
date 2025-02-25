const bcrypt = require('bcrypt');
const User = require('../../models/User/UserSchema');
const Course = require('../../models/Course/CourseSchema');
const Institute = require('../../models/User/InstituteSchema');
const Module = require('../../models/Course/ModuleSchema');
const Section = require('../../models/Course/SectionSchema');
const SectionItem = require('../../models/Course/SectionItems/ItemsSchema');
const Assessment = require('../../models/Course/SectionItems/AssesmentSchema');
const Question = require('../../models/Course/SectionItems/QuestionSchema');
const Video = require('../../models/Course/SectionItems/VideoSchema');

exports.signupController = async (req, res) => {
    try {
        const { firstName, lastName, role, institute, coursesEnrolled, email, password, firebaseUid } = req.body;

        // Hash password before saving it to the database
        const hashedPassword = await bcrypt.hash(password, 10); // The second argument is the number of rounds

        const newUser = new User({
            firstName,
            lastName,
            role,
            institute,
            coursesEnrolled,
            email,
            password: hashedPassword, // Store the hashed password, not the plain one
            firebaseUid
        });

        await newUser.save();
        res.status(201).send(`Signup successful for ${newUser._id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error signing up user: " + error.message);
    }
};
