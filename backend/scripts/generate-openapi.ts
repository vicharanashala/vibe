require('reflect-metadata');
const {getMetadataArgsStorage} = require('routing-controllers');
const {routingControllersToSpec} = require('routing-controllers-openapi');
const {validationMetadatasToSchemas} = require('class-validator-jsonschema');
const fs = require('fs');
const path = require('path');

// Set environment variable to skip database initialization
process.env.SKIP_DB_CONNECTION = 'true';

// Parse command line arguments
const args = process.argv.slice(2);
const outputToStdout = args.includes('--stdout');
// Parse output file argument
const outputFileIndex = args.findIndex(
  arg => arg === '--output' || arg === '-o',
);
const outputFile =
  outputFileIndex !== -1 && outputFileIndex + 1 < args.length
    ? args[outputFileIndex + 1]
    : null;
// Import module options using require
const {authModuleOptions} = require('../src/modules/auth');
const {coursesModuleOptions} = require('../src/modules/courses');
const {usersModuleOptions} = require('../src/modules/users');
const {docsModuleOptions} = require('../src/modules/docs');

// Create combined metadata for OpenAPI
const generateOpenAPISpec = () => {
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
    controllers: allControllers,
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
        description: 'Operations for managing modules within a course version',
        'x-displayName': 'Modules',
        'x-resourceGroup': 'Courses',
      },
      {
        name: 'Course Sections',
        description: 'Operations for managing sections within a course module',
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
};

// Execute and save the OpenAPI specification
const outputDir = path.resolve(__dirname, '../openapi');
const openApiSpec = generateOpenAPISpec();

if (outputToStdout) {
  // Output to console
  console.log(JSON.stringify(openApiSpec, null, 2));
} else {
  // Output to file
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {recursive: true});
  }

  console.log(`Output directory: ${outputFile}`);
  const outputPath = path.join(outputDir, outputFile || 'openapi.json');
  console.log(`Writing OpenAPI specification to: ${outputPath}`);
  try {
    fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));
    console.log(`✨ OpenAPI specification generated at: ${outputPath}`);
  } catch (error) {
    console.error('Error writing OpenAPI specification to file:', error);
    throw error;
  }
}
