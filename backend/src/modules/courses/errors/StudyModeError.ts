import {HttpError} from 'routing-controllers';
import type {StudyModeSource} from '#root/shared/interfaces/models.js';

/** Why a study-mode lesson read was refused. Sent as the error body's `name`. */
export type StudyModeErrorCode = 'STUDY_MODE_DISABLED' | 'STUDY_MODE_QUIZ';

/**
 * 403 for a study-mode lesson read the student isn't allowed. The apps tell
 * these apart from a linear-progression 403 (a plain ForbiddenError) by the
 * response body's `name`, and read `details.source` to say which level of the
 * course (item, section or module) disabled study mode.
 */
export class StudyModeError extends HttpError {
  readonly details: {source?: StudyModeSource};

  constructor(
    code: StudyModeErrorCode,
    message: string,
    source?: StudyModeSource,
  ) {
    super(403, message);
    Object.setPrototypeOf(this, StudyModeError.prototype);
    this.name = code;
    this.details = source ? {source} : {};
  }
}
