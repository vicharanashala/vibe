import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import type { LessonItem, LessonRef } from './queries';

const recordStudyView = vi.fn(async () => undefined);
vi.mock('./queries', async (orig) => ({ ...(await orig<object>()), recordStudyView: (...a: unknown[]) => recordStudyView(...(a as [])) }));

const { useStudyViewRecorder, studyWatchThreshold } = await import('./use-study-view-recorder');

const ref: LessonRef = { courseId: 'c', versionId: 'v', moduleId: 'm', sectionId: 's', itemId: 'i1' };
const video = (endTime = '00:05:00'): LessonItem => ({ _id: 'i1', name: 'V', type: 'VIDEO', details: { startTime: '00:00:00', endTime } });
const article: LessonItem = { _id: 'i1', name: 'A', type: 'BLOG', details: {} };

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children);
}

beforeEach(() => {
  vi.useFakeTimers();
  recordStudyView.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('studyWatchThreshold', () => {
  it('is 10 s, or the whole clip when it is shorter', () => {
    expect(studyWatchThreshold(video('00:05:00'))).toBe(10);
    expect(studyWatchThreshold(video('00:00:06'))).toBe(6);
    expect(studyWatchThreshold({ details: {} })).toBe(10);
  });
});

describe('useStudyViewRecorder', () => {
  it('records an article as soon as it shows, once', () => {
    const { rerender } = renderHook(() => useStudyViewRecorder(ref, article), { wrapper });
    rerender();
    expect(recordStudyView).toHaveBeenCalledTimes(1);
    expect(recordStudyView).toHaveBeenCalledWith(ref);
  });

  it('records a video after 10 s of playing, counted across pauses', () => {
    const { result } = renderHook(() => useStudyViewRecorder(ref, video()), { wrapper });
    act(() => result.current(true));
    act(() => vi.advanceTimersByTime(6000));
    act(() => result.current(false));
    // Paused time doesn't count.
    act(() => vi.advanceTimersByTime(60_000));
    expect(recordStudyView).not.toHaveBeenCalled();
    act(() => result.current(true));
    act(() => vi.advanceTimersByTime(3000));
    expect(recordStudyView).not.toHaveBeenCalled(); // 9 s so far
    act(() => vi.advanceTimersByTime(1100));
    expect(recordStudyView).toHaveBeenCalledTimes(1);
    act(() => result.current(false));
    act(() => result.current(true));
    act(() => vi.advanceTimersByTime(20_000));
    expect(recordStudyView).toHaveBeenCalledTimes(1);
  });

  it('does not record a video that was opened but never played', () => {
    renderHook(() => useStudyViewRecorder(ref, video()), { wrapper });
    act(() => vi.advanceTimersByTime(60_000));
    expect(recordStudyView).not.toHaveBeenCalled();
  });

  it('records a 6-second clip once all of it has played', () => {
    const { result } = renderHook(() => useStudyViewRecorder(ref, video('00:00:06')), { wrapper });
    act(() => result.current(true));
    act(() => vi.advanceTimersByTime(5900));
    expect(recordStudyView).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(recordStudyView).toHaveBeenCalledTimes(1);
  });

  it('never records quizzes or other lesson types', () => {
    const quiz = { _id: 'q', name: 'Q', type: 'QUIZ', details: {} } as LessonItem;
    const { result } = renderHook(() => useStudyViewRecorder(ref, quiz), { wrapper });
    act(() => result.current(true));
    act(() => vi.advanceTimersByTime(60_000));
    expect(recordStudyView).not.toHaveBeenCalled();
  });

  it('ignores a failed record instead of interrupting', async () => {
    recordStudyView.mockRejectedValueOnce(new Error('offline'));
    renderHook(() => useStudyViewRecorder(ref, article), { wrapper });
    await act(() => Promise.resolve());
    expect(recordStudyView).toHaveBeenCalledTimes(1);
  });
});
