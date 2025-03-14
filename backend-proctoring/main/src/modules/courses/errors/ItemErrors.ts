export class CreateItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateItemError";
  }
}

export class FetchItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchItemError";
  }
}

export class UpdateItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateItemError";
  }
}

export class DeleteItemError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DeleteItemError";
    }
}