// models.ts pulls in class-transformer decorators, which need the metadata
// polyfill loaded first — same first line as every other suite here.
import 'reflect-metadata';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  YouTubeEmbedFailure,
  YouTubeEmbedService,
} from '../services/YouTubeEmbedService.js';

const service = new YouTubeEmbedService();

function mockOembed(status: number, body: unknown = {}) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('YouTubeEmbedService.extractVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
  ])('reads the id out of %s', (url, expected) => {
    expect(service.extractVideoId(url)).toBe(expected);
  });

  it.each([
    'https://vimeo.com/12345',
    'https://www.youtube.com/watch?v=tooshort',
    'not a url at all',
    'https://www.youtube.com/',
  ])('rejects %s', url => {
    expect(service.extractVideoId(url)).toBeNull();
  });
});

describe('YouTubeEmbedService.check', () => {
  it('accepts an embeddable video and returns its title', async () => {
    mockOembed(200, {title: 'A lecture'});

    const result = await service.check(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result).toMatchObject({
      embeddable: true,
      videoId: 'dQw4w9WgXcQ',
      title: 'A lecture',
    });
  });

  it('rejects a non-YouTube link before calling out to YouTube', async () => {
    const fetchSpy = mockOembed(200);

    const result = await service.check('https://vimeo.com/12345');

    expect(result.embeddable).toBe(false);
    expect(result.reason).toBe(YouTubeEmbedFailure.INVALID_URL);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports a deleted video as not found', async () => {
    mockOembed(404);

    const result = await service.check(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.embeddable).toBe(false);
    expect(result.reason).toBe(YouTubeEmbedFailure.NOT_FOUND);
    expect(result.message).toBeTruthy();
  });

  it.each([401, 403])(
    'reports embedding as disabled on %i',
    async status => {
      mockOembed(status);

      const result = await service.check('https://youtu.be/dQw4w9WgXcQ');

      expect(result.embeddable).toBe(false);
      expect(result.reason).toBe(YouTubeEmbedFailure.EMBEDDING_DISABLED);
    },
  );

  it('never claims a video is embeddable when YouTube is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const result = await service.check('https://youtu.be/dQw4w9WgXcQ');

    // Failing open here would send links out for a video that may not play.
    expect(result.embeddable).toBe(false);
    expect(result.reason).toBe(YouTubeEmbedFailure.CHECK_FAILED);
  });

  it('carries a message the instructor can act on for every failure', async () => {
    mockOembed(401);

    const result = await service.check('https://youtu.be/dQw4w9WgXcQ');

    expect(result.message).toMatch(/embedding/i);
  });
});
