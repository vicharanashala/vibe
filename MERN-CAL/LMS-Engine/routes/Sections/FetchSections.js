const express = require('express');
const { fetchSectionsController } = require('../../controllers/Sections/FetchSectionsController');
const { createSectionController } = require('../../controllers/Sections/CreateSectionsController');

const sectionRouter = express.Router();

sectionRouter.get('/section', fetchSectionsController);
sectionRouter.post('/section', createSectionController);

module.exports = sectionRouter;
