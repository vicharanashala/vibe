import {appConfig} from '../../config/app';
import {Middleware, ExpressErrorMiddlewareInterface} from 'routing-controllers';
import {Service} from 'typedi';
import {Response, Request, NextFunction} from 'express';

export class HTTPError extends Error {
  httpCode: number;

  constructor(httpCode: number, error: Error) {
    super(error.message, {cause: error.cause});
    this.httpCode = httpCode;
    this.stack = error.stack;
    this.name = error.name;
  }
}

@Service()
@Middleware({type: 'after'})
export class HttpErrorHandler implements ExpressErrorMiddlewareInterface {
  error(
    error: unknown,
    request: Request,
    response: Response,
    next: NextFunction,
  ) {
    if (error instanceof HTTPError) {
      response.status(error.httpCode).json({
        error: {
          name: error.name,
          message: error.message,
          httpCode: error.httpCode,
          stack: !appConfig.isProduction ? error.stack : undefined,
        },
      });
    }

    next(error);
  }
}
