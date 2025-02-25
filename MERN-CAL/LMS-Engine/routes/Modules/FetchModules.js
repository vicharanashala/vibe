const express = require('express');
const { fetchModulesController } = require('../../controllers/Modules/FetchModulesController');

const moduleRouter = express.Router();

// Define the signup route
moduleRouter.get('/module', fetchModulesController);

module.exports = moduleRouter;
