import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession } from '@/test/session';
import { SAMPLE, signInAdmin } from '@/test/studio';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const content = `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}?tab=content`;
const VERSION = '/api/courses/versions/{versionId}';
const ITEMS = '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items';
const SETTINGS = '/api/setting/course-setting/{courseId}/{versionId}';
const MODULE_STUDY = '/api/courses/versions/{versionId}/modules/{moduleId}/study-mode';
const ITEM_STUDY = '/api/courses/versions/{versionId}/items/{itemId}/study-mode';

const [firstModule] = fixtures.courseVersion.modules;
const [firstItem, secondItem] = fixtures.sectionItems;

function withGet(overrides: Record<string, unknown>) {
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => (p in overrides ? ok(overrides[p]) : fallback(p, ...rest)));
}

/** The first module with study mode turned off, everything else unset. */
function versionWithModuleOff() {
  const version = structuredClone(fixtures.courseVersion);
  (version.modules[0] as { studyModeEnabled?: boolean }).studyModeEnabled = false;
  return version;
}

// The submenu reports `pointer-events: none` in jsdom while it opens.
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

/** Both sections share the section-items fixture, so lesson rows repeat; the first is used. */
/** Picks a study-mode option the way a keyboard user does (jsdom's synthetic pointer clicks don't reach Base UI radio items). */
async function choose(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  const option = await screen.findByRole('menuitemradio', { name });
  option.focus();
  await user.keyboard('{Enter}');
}

async function openStudyMenu(user: ReturnType<typeof userEvent.setup>, rowLabel: string) {
  await user.click((await screen.findAllByRole('button', { name: `${rowLabel}: actions` }))[0]);
  await user.click(await screen.findByRole('menuitem', { name: 'Study mode' }));
}

beforeEach(() => {
  resetSession();
  signInAdmin();
});

describe('studio study-mode switches', () => {
  it('turns study mode off for a module', async () => {
    const user = setupUser();
    renderApp(content);
    await openStudyMenu(user, `Module ${firstModule.name}`);
    await choose(user, /Off: strict mode only/);
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(MODULE_STUDY, {
        params: { path: { versionId: SAMPLE.versionId, moduleId: firstModule.moduleId } },
        body: { studyModeEnabled: false },
      }),
    );
  });

  it('shows a disabled module, and its sections and lessons as inherited', async () => {
    withGet({ [VERSION]: versionWithModuleOff() });
    renderApp(content);
    expect(await screen.findByText('Study mode off')).toBeInTheDocument();
    await setupUser().click(screen.getByRole('button', { name: 'Expand all' }));
    // The module's section, plus both lessons in it, inherit the setting.
    await waitFor(() => expect(screen.getAllByText('Study mode off (inherited)').length).toBeGreaterThanOrEqual(3));
  });

  it('lets one lesson turn study mode back on inside a disabled module', async () => {
    withGet({
      [VERSION]: versionWithModuleOff(),
      [ITEMS]: [{ ...firstItem, studyModeEnabled: true }, secondItem],
    });
    const user = setupUser();
    renderApp(content);
    await user.click(await screen.findByRole('button', { name: 'Expand all' }));
    const firstRow = (await screen.findAllByRole('button', { name: firstItem.name }))[0].closest('li')!;
    expect(within(firstRow).getByText('Study mode on')).toBeInTheDocument();
    const secondRow = screen.getAllByRole('button', { name: secondItem.name })[0].closest('li')!;
    expect(within(secondRow).getByText('Study mode off (inherited)')).toBeInTheDocument();

    // The saved value is selected in the menu, and "Inherit" names what it would inherit.
    await openStudyMenu(user, `Lesson ${firstItem.name}`);
    expect(await screen.findByRole('menuitemradio', { name: /On: students may study it/ })).toHaveAttribute('aria-checked', 'true');
    await choose(user, 'Inherit (off)');
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(ITEM_STUDY, {
        params: { path: { versionId: SAMPLE.versionId, itemId: firstItem._id } },
        body: { studyModeEnabled: null },
      }),
    );
  });

  it('explains a failed save and keeps the saved value', async () => {
    api.PUT.mockImplementation(async () => ({
      data: undefined,
      error: { message: 'Server unavailable' },
      response: new Response(null, { status: 500 }),
    }));
    const user = setupUser();
    renderApp(content);
    await openStudyMenu(user, `Module ${firstModule.name}`);
    await choose(user, /Off: strict mode only/);
    expect(await screen.findByText(/Study mode wasn’t saved: Server unavailable/)).toBeInTheDocument();
    expect(screen.queryByText('Study mode off')).not.toBeInTheDocument();
  });
});

describe('studio course settings', () => {
  it('keeps linear progression on when saving a course whose value was never set', async () => {
    const { linearProgressionEnabled: _unset, ...rest } = fixtures.courseSettings.settings;
    withGet({ [SETTINGS]: { ...fixtures.courseSettings, settings: rest } });
    const user = userEvent.setup();
    renderApp(`/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}?tab=proctoring`);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.click(await screen.findByRole('switch', { name: /Face count/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith('/api/setting/course-setting/{courseId}/{versionId}/proctoring', expect.anything()),
    );
    const body = api.PUT.mock.calls.find((c) => c[0] === '/api/setting/course-setting/{courseId}/{versionId}/proctoring')![1].body;
    expect(body.linearProgressionEnabled).toBe(true);
  });
});

describe('studio outline collapsing', () => {
  const [, secondModule] = fixtures.courseVersion.modules;
  const itemRequests = () => api.GET.mock.calls.filter(([p]) => p === ITEMS).length;

  it('starts with sections collapsed and loads no lessons until one is opened', async () => {
    const user = setupUser();
    renderApp(content);
    const section = firstModule.sections[0];
    expect(await screen.findByRole('button', { name: `Expand ${section.name}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: firstItem.name })).not.toBeInTheDocument();
    expect(itemRequests()).toBe(0);

    await user.click(screen.getByRole('button', { name: `Expand ${section.name}` }));
    expect(await screen.findByRole('button', { name: firstItem.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Collapse ${section.name}` })).toBeInTheDocument();
    // Only the opened section asked for its lessons.
    expect(itemRequests()).toBe(1);
  });

  it('expands and collapses every module and section at once', async () => {
    const user = setupUser();
    renderApp(content);
    await user.click(await screen.findByRole('button', { name: 'Expand all' }));
    for (const m of fixtures.courseVersion.modules)
      for (const sec of m.sections) expect(screen.getByRole('button', { name: `Collapse ${sec.name}` })).toBeInTheDocument();
    expect((await screen.findAllByRole('button', { name: firstItem.name })).length).toBe(fixtures.courseVersion.modules.length);

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.getByRole('button', { name: `Expand ${firstModule.name}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Expand ${secondModule.name}` })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: firstItem.name })).not.toBeInTheDocument());
  });
});
