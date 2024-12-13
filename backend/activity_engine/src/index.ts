import express from 'express';
import routes from './api/v1/routes/index';
import { apiReference } from '@scalar/express-api-reference';
import { errorHandler } from './api/v1/middlewares/errorHandler';
import path from 'path';

const app = express();

// Serve your openapi.json
app.use('/openapi.json', express.static(path.join(__dirname, '../openapi.json')));

// Integrate Scalar docs
app.use(
  '/reference',
  apiReference({
    spec: {
      // This should point to where openapi.json is served:
      url: '/openapi.json',
    },
  })
);


app.use(express.json());
app.use('/v1', routes);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Activity service running on port ${PORT}`);
});
