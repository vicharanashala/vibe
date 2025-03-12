const express = require('express');
const { fetchModulesController } = require('../../controllers/Modules/FetchModulesController');
const { createModuleController } = require('../../controllers/Modules/CreateModulesController');

const moduleRouter = express.Router();

// Define the signup route
moduleRouter.get('/module', fetchModulesController);
moduleRouter.post('/module', createModuleController);

module.exports = moduleRouter;
