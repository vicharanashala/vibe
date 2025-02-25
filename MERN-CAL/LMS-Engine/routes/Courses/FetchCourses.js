const express = require('express');
const { fetchCourseController } = require('../../controllers/Courses/FetchCourseController');
const { postCourseController } = require('../../controllers/Courses/PostCourseController');

const courseRouter = express.Router();

// Define the signup route
courseRouter.get('/course', fetchCourseController);
courseRouter.post('/course', postCourseController);

module.exports = courseRouter;
