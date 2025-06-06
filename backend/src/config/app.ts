// import path from 'path';
// import {fileURLToPath} from 'url';

import {env} from '#root/utils/env.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// function getAppPath() {
//   let currentDir = __dirname;
//   currentDir = currentDir.replace('/config', '');

//   return currentDir;
// }

export const appConfig = {
  node: env('NODE_ENV') || 'development',
  isProduction: env('NODE_ENV') === 'production',
  isStaging: env('NODE_ENV') === 'staging',
  isDevelopment: env('NODE_ENV') === 'development',
  name: env('APP_NAME'),
  port: Number(env('APP_PORT')) || 4000,
  routePrefix: env('APP_ROUTE_PREFIX'),
  url: env('APP_URL'),
  // appPath: getAppPath(),
};
