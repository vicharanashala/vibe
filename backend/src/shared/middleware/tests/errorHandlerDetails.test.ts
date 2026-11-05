import 'reflect-metadata';
import {describe, expect, it} from 'vitest';
import {ForbiddenError} from 'routing-controllers';

import {HttpErrorHandler} from '../errorHandler.js';
import {StudyModeError} from '#courses/errors/StudyModeError.js';

function send(error: unknown) {
  const res: any = {
    headersSent: false,
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = JSON.parse(JSON.stringify(body));
      return this;
    },
  };
  new HttpErrorHandler().error(error, {} as any, res);
  return res;
}

describe('HttpErrorHandler details', () => {
  it('sends a StudyModeError as 403 with its code as name and its details', () => {
    const res = send(
      new StudyModeError(
        'STUDY_MODE_DISABLED',
        'The instructor has disabled study mode for this module.',
        'module',
      ),
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      name: 'STUDY_MODE_DISABLED',
      message: 'The instructor has disabled study mode for this module.',
      details: {source: 'module'},
    });
  });

  it('sends a quiz refusal with its own code', () => {
    const res = send(
      new StudyModeError(
        'STUDY_MODE_QUIZ',
        'Quizzes can only be taken in strict mode on a computer.',
      ),
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.name).toBe('STUDY_MODE_QUIZ');
    expect(res.body.details).toEqual({});
  });

  it('leaves an ordinary HttpError body exactly as before (no details key)', () => {
    const res = send(
      new ForbiddenError("You don't have permission to watch this item"),
    );
    expect(res.statusCode).toBe(403);
    const {sentryEventId, ...rest} = res.body;
    expect(rest).toEqual({
      message: "You don't have permission to watch this item",
      name: 'ForbiddenError',
    });
    expect('details' in res.body).toBe(false);
  });
});
