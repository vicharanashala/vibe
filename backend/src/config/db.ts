import {env} from '../utils/env.js';

export const dbConfig = {
  url: env('DB_URL'),
  dbName: env('DB_NAME') || 'vibe',
};
