const express = require('express');
const { fetchAllUsersController } = require('../../controllers/Users/FetchAllUsers'); 
const { bulkSignup } = require('../../controllers/Users/BulkSignup');

const userRouter = express.Router();

// GET request to fetch all users
userRouter.get('/getusers',fetchAllUsersController);
userRouter.post('/bulkSignup',bulkSignup);

module.exports = userRouter;