const express = require('express');
const { fetchSectionItemsController } = require('../../controllers/SectionItems/SectionItemsController');
const { createVideos } = require('../../controllers/SectionItems/CreateVideosController');
const { createAssessment } = require('../../controllers/SectionItems/CreateAssessmentController');
const { bulkUpload } = require('../../controllers/SectionItems/BulkCreateSectionitems');

const sectionItemsRouter = express.Router();

sectionItemsRouter.get('/sectionItem', fetchSectionItemsController);
sectionItemsRouter.post('/video', createVideos);
sectionItemsRouter.post('/assessment', createAssessment);
sectionItemsRouter.post('/bulkUpload', bulkUpload);

module.exports = sectionItemsRouter;
