const express = require('express');
const { fetchSectionItemsController } = require('../../controllers/SectionItems/SectionItemsController');

const sectionItemsRouter = express.Router();

sectionItemsRouter.get('/sectionItem', fetchSectionItemsController);

module.exports = sectionItemsRouter;
