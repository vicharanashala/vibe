import {logger} from '@sentry/node';
import {ValidationError} from 'class-validator';
import {
  Middleware,
  ExpressErrorMiddlewareInterface,
  HttpError,
  UnauthorizedError,
} from 'routing-controllers';
import {Request, Response} from 'express';
import {Service} from 'typedi';

export class ErrorResponse<T> {
  message: string;
  errors?: T;

  constructor(message: string, errors?: T) {
    if (errors) this.errors = errors;
    this.message = message;
  }
}

import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsDefined,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

class ValidationErrorResponse {
  @JSONSchema({
    type: 'object',
    description: 'The object that was validated.',
    readOnly: true,
  })
  @IsObject() // Ensures 'target' is an object
  target: object;

  @JSONSchema({
    type: 'string',
    description: 'The property that failed validation.',
    readOnly: true,
  })
  @IsString() // Ensures 'property' is a string
  @IsDefined() // Makes 'property' a required field
  property: string;

  @JSONSchema({
    type: 'object',
    description: 'The value that failed validation.',
    readOnly: true,
  })
  value: any;

  @JSONSchema({
    type: 'object',
    description: 'Constraints that failed validation with error messages.',
    readOnly: true,
  })
  @IsObject() // Ensures 'constraints' is an object
  constraints: {[type: string]: string};

  @JSONSchema({
    type: 'array',
    format: 'ValidationErrorResponse',
    description: 'Contains all nested validation errors of the property.',
    readOnly: true,
  })
  @IsArray() // Ensures 'children' is an array
  @ValidateNested({each: true}) // Ensures each element inside 'children' is validated
  children: ValidationErrorResponse[];

  @JSONSchema({
    type: 'object',
    description: 'Contains all nested validation errors of the property.',
    readOnly: true,
  })
  @IsObject() // Ensures 'contexts' is an object
  @IsOptional() // Makes 'contexts' optional
  contexts: {[type: string]: any};
}

class DefaultErrorResponse {
  @IsString()
  @JSONSchema({
    type: 'string',
    description: 'The error message.',
    readOnly: true,
  })
  message: string;
}

class BadRequestErrorResponse {
  @JSONSchema({
    type: 'string',
    description: 'The error message.',
    readOnly: true,
  })
  @IsString()
  message: string;

  @JSONSchema({
    type: 'object',
    description: 'The error details.',
    readOnly: true,
  })
  @IsObject()
  @ValidateNested()
  errors?: ValidationErrorResponse;
}

@Service()
@Middleware({type: 'after'})
export class HttpErrorHandler implements ExpressErrorMiddlewareInterface {
  error(error: any, request: Request, response: Response): void {
    // class CustomValidationError {
    //     errors: ValidationError[];
    // }

    // /* CustomErrorHandler class - error method */
    // if (
    //     'errors' in error &&
    //     error.errors[0] instanceof ValidationError
    // ) {
    //     const errorMessages: { [x: string]: string }[] = findProp(
    //         error,
    //         'constraints',
    //     );

    //     response
    //         .status(400)
    //         .json(new ErrorResponse(getValues(errorMessages)));
    // } else {
    //     response
    //         .status(error.httpCode)
    //         .json(new ErrorResponse<null>(null, error.message));
    // }
    // function findProp(obj: any, key: string, result: any[] = []): any[] {
    //     const proto = Object.prototype;
    //     const ts = proto.toString;
    //     const hasOwn = proto.hasOwnProperty.bind(obj);

    //     if ('[object Array]' !== ts.call(result)) {
    //         result = [];
    //     }

    //     for (let i in obj) {
    //         if (hasOwn(i)) {
    //             if (i === key) {
    //                 result.push(obj[i]);
    //             } else if (
    //                 '[object Array]' === ts.call(obj[i]) ||
    //                 '[object Object]' === ts.call(obj[i])
    //             ) {
    //                 findProp(obj[i], key, result);
    //             }
    //         }
    //     }

    //     return result;
    // }

    // function getValues(arrayOfObjects: { [x: string]: string }[]): string[] {
    //     const result: string[] = [];

    //     for (let item of arrayOfObjects) {
    //         result.push(...Object.values(item));
    //     }

    //     return result;
    // }

    if (error instanceof UnauthorizedError) {
      response
        .status(401)
        .json(
          new ErrorResponse<null>(
            'You are not authorized to access this resource.',
          ),
        );
    } else if (error instanceof HttpError) {
      if ('errors' in error && error.errors[0] instanceof ValidationError) {
        response
          .status(400)
          .json(
            new ErrorResponse<typeof error.errors>(error.message, error.errors),
          );
      } else {
        response
          .status(error.httpCode)
          .json(new ErrorResponse<null>(error.message));
      }
    } else if (error instanceof Error) {
      response.status(500).json(new ErrorResponse<null>(error.message));
    } else {
      response
        .status(500)
        .json(new ErrorResponse<null>('An unexpected error occurred.'));
    }
  }
}

export {DefaultErrorResponse, ValidationErrorResponse, BadRequestErrorResponse};
