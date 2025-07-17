import cors from 'cors';
import {Request, Response, NextFunction} from 'express';

// Configure CORS options
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, desktop apps, etc.)
    if (!origin) return callback(null, true);

    // Define allowed origins based on environment
    const allowedOrigins = [
      'http://localhost:3000', // Default frontend dev server
      'http://localhost:5173', // Vite default port
      'http://localhost:4000', // Alternative frontend port
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4000',
      'https://vibe-5b35a.web.app',
    ];

    // In production, add your production domain
    if (process.env.NODE_ENV === 'production') {
      // Add your production frontend URL here
      // allowedOrigins.push('https://yourdomain.com');
    }

    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true, // Allow cookies and credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: ['set-cookie'],
};

// Export the configured CORS middleware
export const corsHandler = cors(corsOptions);

// Alternative: Export a function that can be customized per module
export function createCorsHandler(additionalOrigins: string[] = []) {
  const customOptions = {
    ...corsOptions,
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:4000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4000',
        'https://vibe-5b35a.web.app',
        ...additionalOrigins,
      ];

      if (process.env.NODE_ENV === 'production') {
        // Add production origins here
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
  };

  return cors(customOptions);
}
