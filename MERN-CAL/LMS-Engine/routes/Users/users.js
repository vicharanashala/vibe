const express = require('express');
const { fetchAllUsersController } = require('../../controllers/Users/FetchAllUsers'); 

const userRouter = express.Router();

// GET request to fetch all users
userRouter.get('/getusers',fetchAllUsersController);

module.exports = userRouter;