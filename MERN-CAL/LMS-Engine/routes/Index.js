const express = require('express');
const authRouter = require('./Auth/AuthRoutes');
const courseRouter = require('./Courses/FetchCourses');
const moduleRouter = require('./Modules/FetchModules');
const sectionRouter = require('./Sections/FetchSections');
const sectionItemsRouter = require('./SectionItems/SectionItems');
const questionsRouter = require('./SectionItems/Questions');
const userRouter = require('./Users/users');
const { init } = require('../models/Course/CourseSchema');
const initializeProgressRouter = require('./Progress/InitializeProgress');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/courses', courseRouter);
router.use('/modules', moduleRouter);
router.use('/sections', sectionRouter);
router.use('/sectionItems', sectionItemsRouter);
router.use('/questions', questionsRouter);
router.use('/users', userRouter);
router.use('/progress', initializeProgressRouter);

module.exports = router;