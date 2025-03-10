const express = require('express');
const { enrollStudents } = require('../../controllers/Progress/InitializeProgress');

const initializeProgressRouter = express.Router();

// Define the signup route
initializeProgressRouter.post('/initialize-progress/:batchName', enrollStudents);

module.exports = initializeProgressRouter;
