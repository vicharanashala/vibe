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
const SETTINGS = '/api/setting/course-setting/{courseId}/{versionId}';
const MOVE_MODULE = '/api/courses/versions/{versionId}/modules/{moduleId}/move';
const MOVE_SECTION = '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/move';
const MODULES = '/api/courses/versions/{versionId}/modules';
const SECTIONS = '/api/courses/versions/{versionId}/modules/{moduleId}/sections';

const [moduleA, moduleB] = fixtures.courseVersion.modules as unknown as { moduleId: string; name: string; sections: { sectionId: string; name: string; order: string }[] }[];
const sectionA = moduleA.sections[0];
// A second section in the first module, so sections can be reordered.
const sectionB = { ...sectionA, sectionId: '6ac670a84ec7ef17228a73ee', name: 'Setting up', order: '0|i00007:' };

function withTwoSections() {
  const version = structuredClone(fixtures.courseVersion) as unknown as typeof fixtures.courseVersion & { modules: typeof moduleA[] };
  version.modules[0].sections.push(sectionB as never);
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => (p === VERSION ? ok(version) : fallback(p, ...rest)));
}

/** jsdom has no layout: give elements a box from their place among their siblings (dnd-kit's keyboard sensor needs it). */
function layoutRows() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    // Lists contain their rows (drags are kept inside their parent list).
    if (this.tagName === 'OL' || this.tagName === 'UL')
      return { x: 0, y: 0, top: 0, left: 0, bottom: 10000, right: 600, width: 600, height: 10000, toJSON: () => ({}) } as DOMRect;
    const i = this.parentElement ? Array.prototype.indexOf.call(this.parentElement.children, this) : 0;
    const top = i * 120;
    return { x: 0, y: top, top, left: 0, bottom: top + 100, right: 600, width: 600, height: 100, toJSON: () => ({}) } as DOMRect;
  });
}

async function keyboardDrag(user: ReturnType<typeof userEvent.setup>, handleName: string, key: 'ArrowUp' | 'ArrowDown') {
  const handle = (await screen.findAllByRole('button', { name: handleName }))[0];
  handle.focus();
  await user.keyboard('[Space]');
  await user.keyboard(`[${key}]`);
  await user.keyboard('[Space]');
}

const calls = (path: string, method: 'PUT' | 'POST') => api[method].mock.calls.filter(([p]) => p === path);

/** The backend reorders sections and modules only when the course's linear progression is off. */
function withLinearProgression(on: boolean) {
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) =>
    p === SETTINGS
      ? ok({ ...fixtures.courseSettings, settings: { ...fixtures.courseSettings.settings, linearProgressionEnabled: on } })
      : fallback(p, ...rest),
  );
}

beforeEach(() => {
  resetSession();
  signInAdmin();
  layoutRows();
  withLinearProgression(false);
});
afterEach(() => vi.restoreAllMocks());

describe('arranging modules', () => {
  it('drags a module up with the keyboard and saves it before the module it passed', async () => {
    const user = userEvent.setup();
    renderApp(content);
    await keyboardDrag(user, `Drag to reorder module ${moduleB.name}`, 'ArrowUp');
    await waitFor(() => expect(calls(MOVE_MODULE, 'PUT')).toHaveLength(1));
    const [, request] = calls(MOVE_MODULE, 'PUT')[0];
    expect(request.params.path.moduleId).toBe(moduleB.moduleId);
    expect(request.body).toEqual({ beforeModuleId: moduleA.moduleId });
  });

  it('moves a module down from its menu', async () => {
    const user = userEvent.setup();
    renderApp(content);
    await user.click(await screen.findByRole('button', { name: `Module ${moduleA.name}: actions` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));
    await waitFor(() => expect(calls(MOVE_MODULE, 'PUT')).toHaveLength(1));
    expect(calls(MOVE_MODULE, 'PUT')[0][1].body).toEqual({ afterModuleId: moduleB.moduleId });
  });

  it('“Add above” creates the new module before it', async () => {
    const user = userEvent.setup();
    renderApp(content);
    await user.click(await screen.findByRole('button', { name: `Module ${moduleB.name}: actions` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Add above' }));
    const dialog = await screen.findByRole('dialog', { name: 'New module' });
    await user.type(within(dialog).getByLabelText('Name'), 'Warm-up');
    await user.type(within(dialog).getByLabelText('Description'), 'Before the lookups');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(calls(MODULES, 'POST')).toHaveLength(1));
    expect(calls(MODULES, 'POST')[0][1].body).toEqual({ name: 'Warm-up', description: 'Before the lookups', beforeModuleId: moduleB.moduleId });
  });

  it('“Add module” at the top still adds at the end', async () => {
    const user = userEvent.setup();
    renderApp(content);
    await user.click(await screen.findByRole('button', { name: 'Add module' }));
    const dialog = await screen.findByRole('dialog', { name: 'New module' });
    await user.type(within(dialog).getByLabelText('Name'), 'Wrap-up');
    await user.type(within(dialog).getByLabelText('Description'), 'The end');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(calls(MODULES, 'POST')).toHaveLength(1));
    expect(calls(MODULES, 'POST')[0][1].body).toEqual({ name: 'Wrap-up', description: 'The end' });
  });
});

describe('arranging sections', () => {
  it('drags a section up with the keyboard within its module', async () => {
    withTwoSections();
    const user = userEvent.setup();
    renderApp(content);
    await keyboardDrag(user, `Drag to reorder section ${sectionB.name}`, 'ArrowUp');
    await waitFor(() => expect(calls(MOVE_SECTION, 'PUT')).toHaveLength(1));
    const [, request] = calls(MOVE_SECTION, 'PUT')[0];
    expect(request.params.path).toMatchObject({ moduleId: moduleA.moduleId, sectionId: sectionB.sectionId });
    expect(request.body).toEqual({ beforeSectionId: sectionA.sectionId });
  });

  it('the section’s “+” creates a section directly below it', async () => {
    withTwoSections();
    const user = userEvent.setup();
    renderApp(content);
    await user.click(await screen.findByRole('button', { name: `Add a section below ${sectionA.name}` }));
    const dialog = await screen.findByRole('dialog', { name: 'New section' });
    await user.type(within(dialog).getByLabelText('Name'), 'Tools');
    await user.type(within(dialog).getByLabelText('Description'), 'What you need');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(calls(SECTIONS, 'POST')).toHaveLength(1));
    expect(calls(SECTIONS, 'POST')[0][1].body).toEqual({ name: 'Tools', description: 'What you need', afterSectionId: sectionA.sectionId });
  });

  it('puts the old order back and explains when a section move fails', async () => {
    withTwoSections();
    api.PUT.mockImplementation(async () => ({
      data: undefined,
      error: { message: 'Server unavailable' },
      response: new Response(null, { status: 500 }),
    }));
    const user = userEvent.setup();
    renderApp(content);
    await keyboardDrag(user, `Drag to reorder section ${sectionB.name}`, 'ArrowUp');
    expect(await screen.findByText(/The section wasn’t moved: Server unavailable/)).toBeInTheDocument();
  });
});

describe('with linear progression on', () => {
  it('keeps sections and modules in place and says why, while lessons can still move', async () => {
    withLinearProgression(true);
    const user = userEvent.setup();
    renderApp(content);
    const moduleHandle = await screen.findByRole('button', { name: new RegExp(`^Drag to reorder module ${moduleB.name} \\(Turn off linear progression`) });
    expect(moduleHandle).toBeDisabled();
    await user.click(screen.getByRole('button', { name: `Module ${moduleA.name}: actions` }));
    expect(await screen.findByRole('menuitem', { name: 'Move down' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Turn off linear progression in the course settings to reorder sections and modules/)).toBeInTheDocument();
    expect(calls(MOVE_MODULE, 'PUT')).toHaveLength(0);
  });
});
