import 'reflect-metadata';
import {Service} from 'typedi';
import {getMetadataArgsStorage} from 'routing-controllers';
import {routingControllersToSpec} from 'routing-controllers-openapi';
import {validationMetadatasToSchemas} from 'class-validator-jsonschema';

// Import module options
import {authModuleOptions} from '../../auth';
import {coursesModuleOptions} from '../../courses';
import {usersModuleOptions} from '../../users';
import {docsModuleOptions} from '../../docs';

@Service()
export class OpenApiSpecService {
  generateOpenAPISpec() {
    // Get validation schemas
    const schemas = validationMetadatasToSchemas({
      refPointerPrefix: '#/components/schemas/',
      validationError: {
        target: true,
        value: true,
      },
    });

    // Get metadata storage
    const storage = getMetadataArgsStorage();

    // Combine all controllers from different modules
    const allControllers = [
      ...(authModuleOptions.controllers || []),
      ...(coursesModuleOptions.controllers || []),
      ...(usersModuleOptions.controllers || []),
      ...(docsModuleOptions.controllers || []),
    ];

    // Create combined routing-controllers options
    const routingControllersOptions = {
      controllers: allControllers as Function[],
      validation: true,
      routePrefix: '/api',
    };

    // Create OpenAPI specification
    const spec = routingControllersToSpec(storage, routingControllersOptions, {
      info: {
        title: 'ViBe API Documentation',
        version: '1.0.0',
        description: 'API documentation for the ViBe platform',
        contact: {
          name: 'ViBe Team',
          email: 'support@vibe.com',
        },
      },
      tags: [
        // Authentication section
        {
          name: 'Authentication',
          description: 'Operations for user authentication and authorization',
        },

        // Course section and sub-components
        {
          name: 'Courses',
          description: 'Operations related to courses management',
          'x-displayName': 'Courses',
        },
        {
          name: 'Course Versions',
          description: 'Operations for managing different versions of a course',
          'x-displayName': 'Versions',
          'x-resourceGroup': 'Courses',
        },
        {
          name: 'Course Modules',
          description:
            'Operations for managing modules within a course version',
          'x-displayName': 'Modules',
          'x-resourceGroup': 'Courses',
        },
        {
          name: 'Course Sections',
          description:
            'Operations for managing sections within a course module',
          'x-displayName': 'Sections',
          'x-resourceGroup': 'Courses',
        },
        {
          name: 'Course Items',
          description:
            'Operations for managing individual items within a section',
          'x-displayName': 'Items',
          'x-resourceGroup': 'Courses',
        },

        // User management section
        {
          name: 'User Enrollments',
          description: 'Operations for managing user enrollments in courses',
        },
        {
          name: 'User Progress',
          description: 'Operations for tracking and managing user progress',
        },
      ],
      // Use Scalar's preferred grouping approach
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
          name: 'User Management',
          tags: ['User Enrollments', 'User Progress'],
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
      servers: [
        {
          url: 'http://localhost:4001/api',
          description: 'Development server',
        },
        {
          url: 'https://api.vibe.com',
          description: 'Production server',
        },
      ],
      security: [
        {
          bearerAuth: [],
        },
      ],
    });

    return spec;
  }
}
