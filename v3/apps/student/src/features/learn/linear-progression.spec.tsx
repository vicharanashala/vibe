import { screen, waitFor } from '@testing-library/react';

import lockedByModule from '@/test/fixtures/content-locked.json';
import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

import { isLinearCourse, isOrderLocked } from './linear-progression';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const path = fixtures.currentPath;
// A lesson the student hasn't reached: not the current one, not completed.
const laterUrl = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${path.module.id}/${path.section.id}/later-item?track=green`;
const SETTINGS = '/api/setting/course-setting/{courseId}/{versionId}';
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';
const ITEM = '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';
const START = '/api/users/progress/courses/{courseId}/versions/{versionId}/start';

function withLinear(value: boolean | undefined, settingsPending = false, itemLocked = false) {
  const settings = structuredClone(fixtures.courseSettings) as { settings: Record<string, unknown> };
  if (value === undefined) delete settings.settings.linearProgressionEnabled;
  else settings.settings.linearProgressionEnabled = value;
  const base = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => {
    if (p === SETTINGS) return settingsPending ? new Promise(() => undefined) : ok(settings);
    if (p === CONSENT) return ok({ signed: true });
    if (p === ITEM && itemLocked) return { data: undefined, error: lockedByModule, response: new Response(null, { status: 403 }) };
    if (p === ITEM) return ok({ item: { ...fixtures.itemBlog.item, _id: 'later-item', isAlreadyWatched: false } });
    return base(p, ...rest);
  });
}

beforeEach(() => {
  resetSession();
  signInStudent();
});

describe('strict mode and the course’s linear-progression setting', () => {
  it('opens a lesson the student hasn’t reached when linear progression is off', async () => {
    withLinear(false);
    renderApp(laterUrl);
    expect(await screen.findByText(fixtures.itemBlog.item.details.content)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Finish the earlier lessons first' })).not.toBeInTheDocument();
    await waitFor(() => expect(api.POST).toHaveBeenCalledWith(START, expect.objectContaining({ body: expect.objectContaining({ itemId: 'later-item' }) })));
  });

  it('keeps unreached lessons locked when linear progression is on', async () => {
    withLinear(true);
    renderApp(laterUrl);
    expect(await screen.findByRole('heading', { name: 'Finish the earlier lessons first' })).toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalledWith(START, expect.anything());
  });

  it('keeps an instructor-locked lesson locked when linear progression is off', async () => {
    withLinear(false, false, true);
    renderApp(laterUrl);
    expect(await screen.findByRole('heading', { name: 'Locked by your instructor' })).toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalledWith(START, expect.anything());
  });

  it('treats an unset setting as on', async () => {
    withLinear(undefined);
    renderApp(laterUrl);
    expect(await screen.findByRole('heading', { name: 'Finish the earlier lessons first' })).toBeInTheDocument();
  });

  it('shows neither the lesson nor the locked screen while the setting loads', async () => {
    withLinear(false, true);
    renderApp(laterUrl);
    await screen.findAllByText(fixtures.itemBlog.item.name);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText(fixtures.itemBlog.item.details.content)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Finish the earlier lessons first' })).not.toBeInTheDocument();
  });
});

describe('isOrderLocked', () => {
  it('locks only unreached, unfinished lessons in linear courses', () => {
    const base = { itemId: 'b', currentItemId: 'a', alreadyDone: false };
    expect(isOrderLocked({ ...base, linear: true })).toBe(true);
    expect(isOrderLocked({ ...base, linear: false })).toBe(false);
    expect(isOrderLocked({ ...base, linear: true, alreadyDone: true })).toBe(false);
    expect(isOrderLocked({ ...base, linear: true, currentItemId: 'b' })).toBe(false);
    expect(isOrderLocked({ ...base, linear: true, currentItemId: undefined })).toBe(false);
  });

  it('reads unset as on', () => {
    expect(isLinearCourse(undefined)).toBe(true);
    expect(isLinearCourse({ settings: {} })).toBe(true);
    expect(isLinearCourse({ settings: { linearProgressionEnabled: false } })).toBe(false);
  });
});
