import {Request, Response, NextFunction} from 'express';
import chalk from 'chalk';

export function loggingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = Date.now();
  const method = chalk.cyan(req.method);
  const url = chalk.yellow(req.url);
  const ip = chalk.magenta(req.socket.remoteAddress || '-');
  const timestamp = chalk.gray(`[${new Date().toISOString()}]`);

  // Log request received
  console.log(`${timestamp} ${method} ${url} from ${ip}`);

  // Log on finish
  res.on('finish', () => {
    const duration = chalk.blue(`${Date.now() - start}ms`);
    const status =
      res.statusCode < 300
        ? chalk.green(res.statusCode)
        : res.statusCode < 400
          ? chalk.yellow(res.statusCode)
          : chalk.red(res.statusCode);

    console.log(
      `${timestamp} ${method} ${url} from ${ip} - Status: ${status} (${duration})`,
    );
  });

  next();
}
