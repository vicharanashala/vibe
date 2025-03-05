import { env } from '@utils/env';

function getAppPath() {
  let currentDir = __dirname;
  currentDir = currentDir.replace('/config', '');

  return currentDir;
}

export const appConfig = {
  node: env('NODE_ENV') || 'development',
  isProduction: env('NODE_ENV') === 'production',
  isStaging: env('NODE_ENV') === 'staging',
  isDevelopment: env('NODE_ENV') === 'development',
  name: env('APP_NAME'),
  port: Number(env('APP_PORT')) || 4000,
  routePrefix: env('APP_ROUTE_PREFIX'),
  url: env('APP_URL'),
  appPath: getAppPath(),

};
