// File: /routes/Auth/AuthRoutes.js

const express = require('express');
const { signupController } = require('../../controllers/Auth/AuthController');

const authRouter = express.Router();

// Define the signup route
authRouter.post('/signup', signupController);

module.exports = authRouter;
