const express = require('express');
const { postCourseController } = require('../../controllers/Courses/PostCourseController');

const courseRouter = express.Router();

// Define the signup route
courseRouter.post('/course', postCourseController);

module.exports = courseRouter;
