import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { AuthProvider } from '@/features/auth/auth-provider';
import { fakeAuth, resetSession, STUDENT } from '@/test/session';

import { RECENT_COURSES_KEPT, readRecentCourses, recordCourseVisit, useRecentCourses } from './recent-courses';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));

const ids = (uid: string) => readRecentCourses(uid).map((e) => e.courseId);

beforeEach(() => {
  resetSession();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('recent-course history', () => {
  it('keeps the newest first', () => {
    for (const c of ['a', 'b', 'c']) recordCourseVisit('u1', c, `${c}-v1`);
    expect(ids('u1')).toEqual(['a', 'b', 'c']); // SMOKE TEST: deliberately wrong
    expect(readRecentCourses('u1')[0]).toMatchObject({ courseId: 'c', versionId: 'c-v1' });
  });

  it('moves a re-opened course to the top, once, with the version opened last', () => {
    for (const c of ['a', 'b', 'c']) recordCourseVisit('u1', c, `${c}-v1`);
    recordCourseVisit('u1', 'a', 'a-v2');
    expect(ids('u1')).toEqual(['a', 'c', 'b']);
    expect(readRecentCourses('u1')[0].versionId).toBe('a-v2');
  });

  it(`keeps at most ${RECENT_COURSES_KEPT}`, () => {
    for (let i = 0; i < RECENT_COURSES_KEPT + 3; i++) recordCourseVisit('u1', `c${i}`, `v${i}`);
    expect(ids('u1')).toHaveLength(RECENT_COURSES_KEPT);
    expect(ids('u1')[0]).toBe(`c${RECENT_COURSES_KEPT + 2}`);
  });

  it('keeps each user’s history separate', () => {
    recordCourseVisit('u1', 'a', 'a-v1');
    recordCourseVisit('u2', 'b', 'b-v1');
    expect(ids('u1')).toEqual(['a']);
    expect(ids('u2')).toEqual(['b']);
  });

  it('treats corrupt or malformed history as none, and records over it', () => {
    localStorage.setItem('studio:recent-courses:u1', '{not json');
    expect(ids('u1')).toEqual([]);
    localStorage.setItem('studio:recent-courses:u1', JSON.stringify([{ courseId: 'a' }, 'x', { courseId: 'b', versionId: 'v', at: 1 }]));
    expect(ids('u1')).toEqual(['b']);
    recordCourseVisit('u1', 'c', 'c-v1');
    expect(ids('u1')).toEqual(['c', 'b']);
  });

  it('treats blocked storage as no history, without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => recordCourseVisit('u1', 'a', 'a-v1')).not.toThrow();
    expect(ids('u1')).toEqual([]);
  });

  it('updates the hook for the signed-in user when a visit is recorded', () => {
    fakeAuth.currentUser = STUDENT;
    const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children);
    const { result } = renderHook(() => useRecentCourses(), { wrapper });
    expect(result.current).toEqual([]);
    act(() => recordCourseVisit(STUDENT.uid, 'a', 'a-v1'));
    expect(result.current.map((e) => e.courseId)).toEqual(['a']);
    // Another user's visits don't show up.
    act(() => recordCourseVisit('someone-else', 'b', 'b-v1'));
    expect(result.current.map((e) => e.courseId)).toEqual(['a']);
  });
});
