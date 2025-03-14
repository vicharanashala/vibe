export class CreateCourseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateCourseError";
  }
}

export class FetchCourseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchCourseError";
  }
}

export class UpdateCourseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateCourseError";
  }
}

export class DeleteCourseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeleteCourseError";
  }
}
