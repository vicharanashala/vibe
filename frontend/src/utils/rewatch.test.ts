import {describe, it, expect} from 'vitest';
import {resolveRewatchQuizLink} from './rewatch';

const videoId = '60d5ec49b3f1c8e4a8f8b8c4';
const quizId = '60d5ec49b3f1c8e4a8f8b8c9';
const attemptId = '60d5ec49b3f1c8e4a8f8b8c7';

describe('resolveRewatchQuizLink', () => {
  it('links the rewatch when the learner was sent back to this video', () => {
    expect(
      resolveRewatchQuizLink({itemId: videoId, quizId, attemptId}, videoId),
    ).toEqual({quizId, attemptId});
  });

  it('does not link when there is no quiz context', () => {
    expect(resolveRewatchQuizLink(null, videoId)).toBeNull();
    expect(resolveRewatchQuizLink(undefined, videoId)).toBeNull();
  });

  it('does not link when the context was for a different video', () => {
    expect(
      resolveRewatchQuizLink(
        {itemId: '60d5ec49b3f1c8e4a8f8b8c5', quizId, attemptId},
        videoId,
      ),
    ).toBeNull();
  });

  it('drops the link rather than send a malformed id', () => {
    expect(
      resolveRewatchQuizLink({itemId: videoId, quizId, attemptId: ''}, videoId),
    ).toBeNull();
    expect(
      resolveRewatchQuizLink(
        {itemId: videoId, quizId: '[object Object]', attemptId},
        videoId,
      ),
    ).toBeNull();
  });
});
