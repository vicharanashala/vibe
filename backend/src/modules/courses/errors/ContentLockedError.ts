import {HttpError} from 'routing-controllers';
import type {ContentLockSource} from '#root/shared/interfaces/models.js';

const LEVEL: Record<Exclude<ContentLockSource, 'default'>, string> = {
  item: 'lesson',
  section: 'section',
  module: 'module',
};

/**
 * 403 for a student reaching a lesson the instructor locked. The apps tell this
 * apart from other 403s by the response body's `name`, and read
 * `details.source` to say which level of the course locked it.
 */
export class ContentLockedError extends HttpError {
  readonly details: {source: Exclude<ContentLockSource, 'default'>};

  constructor(source: Exclude<ContentLockSource, 'default'>) {
    super(403, `The instructor has locked this ${LEVEL[source]}.`);
    Object.setPrototypeOf(this, ContentLockedError.prototype);
    this.name = 'CONTENT_LOCKED';
    this.details = {source};
  }
}
