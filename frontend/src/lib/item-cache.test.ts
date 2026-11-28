import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateItemCache } from './item-cache';

const ITEM_PATH =
  '/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';

const itemKey = (itemId: string) =>
  [
    'get',
    ITEM_PATH,
    { params: { path: { courseId: 'c1', versionId: 'v1', moduleId: 'm1', sectionId: 's1', itemId } } },
  ] as const;

describe('invalidateItemCache', () => {
  it('invalidates only the query for the given itemId, leaving a different item untouched', () => {
    const queryClient = new QueryClient();

    const videoKey = itemKey('video-A');
    const otherVideoKey = itemKey('video-B');

    queryClient.setQueryData(videoKey, { isAlreadyWatched: true });
    queryClient.setQueryData(otherVideoKey, { isAlreadyWatched: true });

    invalidateItemCache(queryClient, { itemId: 'video-A' });

    expect(queryClient.getQueryState(videoKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherVideoKey)?.isInvalidated ?? false).toBe(false);
  });

  it('leaves an unrelated query (same method, different path) alone', () => {
    const queryClient = new QueryClient();

    const versionKey = ['get', '/courses/versions/{id}', { params: { path: { id: 'v1' } } }] as const;
    queryClient.setQueryData(versionKey, { name: 'Intro to Testing' });

    invalidateItemCache(queryClient, { itemId: 'video-A' });

    expect(queryClient.getQueryState(versionKey)?.isInvalidated ?? false).toBe(false);
  });

  it('is a no-op when nothing is cached for that itemId (no crash, nothing to invalidate)', () => {
    const queryClient = new QueryClient();
    expect(() => invalidateItemCache(queryClient, { itemId: 'never-fetched' })).not.toThrow();
  });
});
