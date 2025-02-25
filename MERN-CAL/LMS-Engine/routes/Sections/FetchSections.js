const express = require('express');
const { fetchSectionsController } = require('../../controllers/Sections/FetchSectionsController');

const sectionRouter = express.Router();

sectionRouter.get('/section', fetchSectionsController);

module.exports = sectionRouter;
