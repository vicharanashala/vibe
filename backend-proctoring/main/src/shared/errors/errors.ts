export class CreateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateError";
  }
}

export class ReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadError";
  }
}

export class UpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateError";
  }
}

export class DeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeleteError";
  }
}
