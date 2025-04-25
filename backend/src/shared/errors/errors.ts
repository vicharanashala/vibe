import {HttpError} from 'routing-controllers';

// 400 - Bad Request
export class CreateError extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = 'CreateError';
  }
}

// 400 - Bad Request
export class ReadError extends HttpError {
  constructor(message: string) {
    super(400, message);
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

// 404 - Not Found
export class ItemNotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
    this.name = 'ItemNotFoundError';
  }
}

// 401 - Unauthorized
export class NotAuthorizedError extends HttpError {
  constructor(message: string) {
    super(401, message);
    this.name = 'NotAuthorizedError';
  }
}

// 409 - Conflict
export class AlreadyExists extends HttpError {
  constructor(message: string) {
    super(409, message);
    this.name = 'UserAlreadyExistsError';
  }
}
