export class CreateVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateVersionError";
  }
}

export class FetchVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchVersionError";
  }
}

export class UpdateVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateVersionError";
  }
}

export class DeleteVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeleteVersionError";
  }
}
