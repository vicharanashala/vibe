/**
 * @fileoverview Entry point for the Activity Engine backend service.
 * This file sets up the Express application, integrates API documentation,
 * and starts the server.
 */

import express from 'express';
import routes from './api/v1/routes/index';
import { apiReference } from '@scalar/express-api-reference';
import { errorHandler } from './api/v1/middlewares/errorHandler';
import path from 'path';

const app = express();

/**
 * Serves the OpenAPI specification file (openapi.json) at the /openapi.json endpoint.
 */
app.use('/openapi.json', express.static(path.join(__dirname, '../openapi.json')));

/**
 * Integrates Scalar API documentation at the /reference endpoint.
 * The documentation is generated based on the OpenAPI specification served at /openapi.json.
 */
app.use(
  '/reference',
  apiReference({
    spec: {
      url: '/openapi.json',
    },
  })
);

app.use(express.json());

/**
 * Mounts the version 1 API routes at the /v1 endpoint.
 */
app.use('/v1', routes);

/**
 * Middleware to handle errors that occur during request processing.
 */
app.use(errorHandler);

/**
 * The port number on which the server will listen for incoming requests.
 * It is either taken from the environment variable `PORT` or defaults to `3000`.
 */
const PORT = process.env.PORT || 3000;

/**
 * Starts the Express server and listens for incoming requests on the specified port.
 */
app.listen(PORT, () => {
  console.log(`Activity service running on port ${PORT}. Access the API documentation at http://localhost:${PORT}/reference`);
});