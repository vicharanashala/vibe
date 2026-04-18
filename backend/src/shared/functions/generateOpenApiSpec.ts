import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import {
  getMetadataArgsStorage,
  RoutingControllersOptions,
} from 'routing-controllers';
import {
  getMetadataStorage,
  MetadataStorage
} from 'class-validator';
import { routingControllersToSpec } from 'routing-controllers-openapi';

import { appConfig } from '../../config/app.js'; // adjust path as needed
import { metadata } from 'reflect-metadata/no-conflict';
import { ValidationMetadata } from 'class-validator/types/metadata/ValidationMetadata.js';
import {defaultMetadataStorage} from 'class-transformer'

const getOpenApiServers = () => {
  const servers = [];

  const isDev = appConfig.isDevelopment;
  const isStaging = appConfig.isStaging;
  const isProd = appConfig.isProduction;

  const appUrl = appConfig.url || 'https://vibe.vicharanashala.ai';
  const parsedUrl = new URL(appUrl);

  if (isDev) {
    // Localhost server
    servers.push({
      url: 'http://{host}:{port}',
      description: 'Local Development Server',
      variables: {
        host: {
          default: 'localhost',
          description: 'Localhost for API server',
        },
        port: {
          default: String(appConfig.port),
          description: 'Port for the API server',
        },
      },
    });

    // Configured dev/staging server
    servers.push({
      url: `https://${parsedUrl.hostname}`,
      description: 'Dev Server (Remote)',
    });
  }

  if (isStaging) {
    servers.push({
      url: `https://${parsedUrl.hostname}`,
      description: 'Staging Server',
    });
  }

  if (isProd) {
    servers.push({
      url: `https://${parsedUrl.hostname}`,
      description: 'Production Server',
    });
    servers.push({
      url: appUrl,
      description: 'Production API Server',
    });
  }

  return servers;
};

export function filterMetadataByModulePrefix(modulePrefix: string) {
  const storage = getMetadataArgsStorage();
  const normalizedPrefix = `/${modulePrefix.toLowerCase()}`;

  // Filter controllers by prefix
  storage.controllers = storage.controllers.filter(
    ctrl =>
      typeof ctrl.route === 'string' &&
      ctrl.route.toLowerCase().startsWith(normalizedPrefix),
  );

  // Collect valid targets (class references)
  const validTargets = new Set(storage.controllers.map(c => c.target));

  // Filter all associated metadata by controller target
  storage.actions = storage.actions.filter(a => validTargets.has(a.target));
}

function getSchemasForValidators(validators: Function[]) {
  const validatorSet = new Set(validators);
  let storage: MetadataStorage = getMetadataStorage();

  const filteredValidationMetadatas: Map<Function, ValidationMetadata[]> = new Map();
  const originalValidationMetadatas = (storage as unknown as any).validationMetadatas as Map<Function, ValidationMetadata[]>;

  for (const [key, value] of originalValidationMetadatas) {
    // Filter validation metadata based on the provided validators
    if (validatorSet.has(key)) {
      filteredValidationMetadatas.set(key, value);
    }
  }

  // Temporarily replace the validation metadata storage
  (storage as any).validationMetadatas = filteredValidationMetadatas;

  // Generate schemas from the filtered validation metadata
  const schemas = validationMetadatasToSchemas({
    refPointerPrefix: '#/components/schemas/',
    classValidatorMetadataStorage: storage,
  });

  // Restore original metadata
  (storage as any).validationMetadatas = originalValidationMetadatas;

  return schemas;
}


export function generateOpenAPISpec(
  routingControllersOptions: RoutingControllersOptions,
  validators: Function[] = [],
) {

  // Get metadata storage
  const storage = getMetadataArgsStorage();

  if (appConfig.module !== 'all') {
    filterMetadataByModulePrefix(appConfig.module);
  }

  let schemas: Record<string, any> = {};
  if (validators.length === 0 || appConfig.module === 'all') {
    // If no specific validators are provided, use all class-validator schemas
    schemas = validationMetadatasToSchemas({
      refPointerPrefix: '#/components/schemas/',
      classTransformerMetadataStorage: defaultMetadataStorage
    });
  } else {
    // If specific validators are provided, filter schemas based on them
    schemas = getSchemasForValidators(validators);
  }

  // Create OpenAPI specification
  const spec = routingControllersToSpec(storage, routingControllersOptions, {
    openapi: '3.0.3',
    info: {
      title: 'ViBe API Documentation',
      version: '1.0.0',
      description: 'API documentation for the ViBe platform',
      contact: {
        name: 'ViBe Team',
        email: 'support@vibe.com',
      },
    },

    // tags: [
    //   {
    //     name: 'Authentication',
    //     description: 'Operations for user authentication and authorization',
    //   },
    // ],
    // 'x-tagGroups': [{
    //   name: 'Auth Module',
    //   tags: ['Authentication'],
    // }, {
    //   name: 'Courses Module',
    //   tags: [
    //     'Courses',
    //     'Course Versions',
    //     'Course Modules',
    //     'Course Sections',
    //     'Course Items',
    //   ],
    // }],

    //   tags: [
    //     // Authentication section
    //     {
    //       name: 'Authentication',
    //       description: 'Operations for user authentication and authorization',
    //     },

    //     // Course section and sub-components
    //     {
    //       name: 'Courses',
    //       description: 'Operations related to courses management',
    //       'x-displayName': 'Courses',
    //     },
    //     {
    //       name: 'Course Versions',
    //       description: 'Operations for managing different versions of a course',
    //       'x-displayName': 'Versions',
    //       'x-resourceGroup': 'Courses',
    //     },
    //     {
    //       name: 'Course Modules',
    //       description:
    //         'Operations for managing modules within a course version',
    //       'x-displayName': 'Modules',
    //       'x-resourceGroup': 'Courses',
    //     },
    //     {
    //       name: 'Course Sections',
    //       description:
    //         'Operations for managing sections within a course module',
    //       'x-displayName': 'Sections',
    //       'x-resourceGroup': 'Courses',
    //     },
    //     {
    //       name: 'Course Items',
    //       description:
    //         'Operations for managing individual items within a section',
    //       'x-displayName': 'Items',
    //       'x-resourceGroup': 'Courses',
    //     },

    //     // User management section
    //     {
    //       name: 'User Enrollments',
    //       description: 'Operations for managing user enrollments in courses',
    //     },
    //     {
    //       name: 'User Progress',
    //       description: 'Operations for tracking and managing user progress',
    //     },
    //   ],
    //   // Use Scalar's preferred grouping approach
      tags:[
        {
          name: 'Courses',
          description: 'Operations related to courses management',
        },
        {
          name: 'Anomalies',
          description: 'Operations for managing anomaly detection and monitoring',
        }
      ],
      'x-tagGroups': [
        {
          name: 'Authentication',
          tags: ['Authentication'],
        },
        {
          name: 'Course Management',
          tags: [
            'Courses',
            'Course Versions',
            'Course Modules',
            'Course Sections',
            'Course Items',
          ],
        },
        {
          name: 'Quizzes',
          tags: ['Quiz', 'Questions', 'Quiz Attempts', 'Question Banks'],
        },
        {
          name: 'GenAI',
          tags: ['GenAI', 'Webhook'],
        },
        {
          name: 'Notifications',
          tags: ['Invites'],
        },
        {
          name: 'Users',
          tags: ['Enrollments','Progress','Users']
        },

        {
          name: 'Monitoring & Security',
          tags: ['Anomalies'],
        },

        {
          name: 'Settings',
          tags: ['Course Settings', 'User Settings', 'Course Setting'],
        },
        {
          name: 'Data Models',
          tags: ['Models'],
        },
      ],
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    servers: getOpenApiServers(),
    security: [
      {
        bearerAuth: [],
      },
    ],
  });

  return spec;
}
