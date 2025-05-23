import {HttpError} from 'routing-controllers';

// 400 - Bad Request
export class CreateError extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = 'CreateError';
  }
}

// 500 - Internal Server Error
export class ReadError extends HttpError {
  constructor(message: string) {
    super(500, message);
    this.name = 'ReadError';
  }
}

// 400 - Bad Request
export class UpdateError extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = 'UpdateError';
  }
}

// 400 - Bad Request
export class DeleteError extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = 'DeleteError';
  }
}
