import chalk from 'chalk';
import { Table } from 'console-table-printer';
import { getMetadataArgsStorage } from 'routing-controllers';
import { appConfig } from '../config/app.js'; // adjust path as needed
import { dbConfig } from '../config/db.js'; // adjust path as needed

export function printStartupSummary() {
  const env = process.env.NODE_ENV || 'development';
  const isDev = env === 'development';
  const isStaging = env === 'staging';
  const isProd = env === 'production';

  const log = console.log;
  const label = (text: string) => (isDev ? chalk.cyan.bold(text) : text);

  log(
    '\n' +
    (isDev
      ? chalk.bgBlue.white.bold('🚀 ViBe REST API Startup Summary')
      : '🚀 ViBe REST API Startup Summary') +
    '\n',
  );

  // 🧩 Application Configuration
  log(label('Environment: ') + env);
  log(label('Port: ') + appConfig.port);
  log(label('App URL: ') + appConfig.url);
  log(label('Module: ') + appConfig.module);
  log(label('Allowed Origins: ') + appConfig.origins.join(', '));

  if (!isProd) {
    log(label('DB Name: ') + dbConfig.dbName);
  }

  // 🔐 Do not print DB URL or other secrets
  if (isDev) {
    log(label('Database URL: ') + chalk.gray('<hidden>'));
  }

  // 📡 Route Table
  if (!isProd) {
    const routes = getMetadataArgsStorage().actions;
    const methodColor = (method: string) => {
      const upper = method.toUpperCase();
      if (!isDev) return upper;
      switch (upper) {
        case 'GET':
          return chalk.green(upper);
        case 'POST':
          return chalk.blue(upper);
        case 'PUT':
          return chalk.yellow(upper);
        case 'PATCH':
          return chalk.hex('#fca130')(upper);
        case 'DELETE':
          return chalk.red(upper);
        case 'OPTIONS':
          return chalk.gray(upper);
        default:
          return chalk.white(upper);
      }
    };

    const grouped: Record<string, any[]> = {};
    for (const route of routes) {
      const ctrl = route.target.name.replace(/Controller$/, '');
      if (!grouped[ctrl]) grouped[ctrl] = [];

      let routePath: string;
      if (typeof route.route === 'string') {
        routePath = route.route.startsWith('/')
          ? route.route
          : '/' + route.route;
      } else if (route.route instanceof RegExp) {
        routePath = route.route.toString();
      } else {
        routePath = String(route.route);
      }

      grouped[ctrl].push({
        Controller: ctrl,
        Method: methodColor(route.type),
        Path: isDev ? chalk.blueBright(routePath) : routePath,
      });
    }

    const t = new Table({
      columns: [
        { name: 'Controller', alignment: 'left' },
        { name: 'Method', alignment: 'left' },
        { name: 'Path', alignment: 'left' },
      ],
      rowSeparator: true,
      title: 'Registered Routes',
    });

    for (const ctrl of Object.keys(grouped)) {
      for (const route of grouped[ctrl]) {
        t.addRow(route, { color: '' });
      }
    }

    t.printTable();

    if (isDev) {
      log(chalk.yellow(`Visit API Reference at ${appConfig.url}/reference`));
    }

  } else {
    const totalRoutes = getMetadataArgsStorage().actions.length;
    log(`Registered Routes: ${totalRoutes}`);
  }

  log('\n');
}
