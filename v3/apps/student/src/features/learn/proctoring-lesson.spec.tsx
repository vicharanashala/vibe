import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

import { IDLE_READINESS, READY, type Readiness } from './proctoring/readiness';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

// Each check's readiness, set per test; the real hooks download models.
const checks = vi.hoisted(() => ({
  faceCount: { readiness: null as unknown, retry: vi.fn() },
  voice: { readiness: null as unknown, retry: vi.fn() },
}));
vi.mock('./detectors/use-face-count-detector', () => ({
  useFaceCountDetector: (_ref: unknown, enabled: boolean) => ({
    faceCount: 1,
    readiness: enabled ? checks.faceCount.readiness : { state: 'ready' },
    retry: checks.faceCount.retry,
  }),
}));
vi.mock('./detectors/use-voice-detector', () => ({
  useVoiceDetector: (_stream: unknown, enabled: boolean) => ({
    isSpeaking: false,
    readiness: enabled ? checks.voice.readiness : { state: 'ready' },
    retry: checks.voice.retry,
  }),
}));

const loader = vi.hoisted(() => ({ clearProctoringCache: vi.fn(async () => undefined), clearAppFiles: vi.fn(async () => undefined) }));
vi.mock('./proctoring/model-loader', async (orig) => ({ ...(await orig<object>()), ...loader }));

// Real diagnostics would reach the model hosts from the test.
vi.mock('./proctoring/diagnostics', async (orig) => ({
  ...(await orig<object>()),
  runDiagnostics: async function* () {
    yield { id: 'wasm', label: 'WebAssembly', status: 'pass', detail: 'Supported.' };
  },
}));

const enrollment = fixtures.enrollments.enrollments[0];
const path = fixtures.currentPath;
const lessonUrl = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${path.module.id}/${path.section.id}/${path.item.id}`;
const ITEM = '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';

function lessonWith(...detectors: string[]) {
  const item = structuredClone(fixtures.itemBlog);
  for (const d of item.item.proctoringDetectors) d.settings.enabled = detectors.includes(d.detectorName);
  const base = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) =>
    p === CONSENT ? ok({ signed: true }) : p === ITEM ? ok(item) : base(p, ...rest),
  );
}

function liveCamera() {
  const track = { readyState: 'live', muted: false, addEventListener: vi.fn(), stop: vi.fn() };
  const stream = { getVideoTracks: () => [track], getAudioTracks: () => [track], getTracks: () => [track, track] };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream), enumerateDevices: vi.fn(async () => []) },
  });
}

const r = (over: Partial<Readiness>): Readiness => ({ ...IDLE_READINESS, ...over });
const setup = () => screen.findByRole('list', { name: 'Proctoring setup' });

beforeEach(() => {
  resetSession();
  signInStudent();
  liveCamera();
  checks.faceCount.readiness = READY;
  checks.voice.readiness = READY;
  checks.faceCount.retry.mockClear();
  checks.voice.retry.mockClear();
});
afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('proctored lesson setup', () => {
  it('lists only the camera and microphone when only the camera check is on', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(() => new Promise(() => undefined)), enumerateDevices: vi.fn(async () => []) },
    });
    lessonWith('cameraMic');
    renderApp(lessonUrl);
    const list = within(await setup());
    expect(list.getAllByRole('listitem').map((i) => i.getAttribute('aria-label'))).toEqual(['Camera', 'Microphone']);
    expect(list.getAllByText('Waiting for your browser to allow access…')).toHaveLength(2);
  });

  it('shows each model the lesson needs, with its own status', async () => {
    lessonWith('faceCountDetection', 'voiceDetection');
    checks.faceCount.readiness = r({ state: 'downloading', received: 1024 * 1024, total: 4 * 1024 * 1024 });
    checks.voice.readiness = r({ state: 'ready', fromCache: true });
    renderApp(lessonUrl);
    const list = within(await setup());
    await waitFor(() => expect(list.getByRole('listitem', { name: 'Camera' })).toHaveTextContent('On'));
    expect(list.getByRole('listitem', { name: 'Face detection' })).toHaveTextContent('Downloading: 1.0 of 4.0 MB · 25%');
    expect(list.getByRole('listitem', { name: 'Voice detection' })).toHaveTextContent('Saved on this device');
  });

  it('opens the lesson once everything is ready', async () => {
    lessonWith('faceCountDetection', 'voiceDetection');
    renderApp(lessonUrl);
    expect(await screen.findByRole('heading', { name: fixtures.itemBlog.item.name })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Proctoring setup' })).not.toBeInTheDocument());
    expect(screen.getByText(fixtures.itemBlog.item.details.content).closest('[aria-hidden="true"]')).toBeNull();
  });

  it('keeps the checklist open on a failed model, and retries only that check', async () => {
    lessonWith('faceCountDetection', 'voiceDetection');
    checks.voice.readiness = r({ state: 'failed', error: 'Couldn’t reach the model server.' });
    renderApp(lessonUrl);
    const list = within(await setup());
    expect(screen.getByRole('heading', { name: 'Something needs your attention' })).toBeInTheDocument();
    const voice = within(list.getByRole('listitem', { name: 'Voice detection' }));
    expect(voice.getByText('Failed: couldn’t reach the model server.')).toBeInTheDocument();
    await userEvent.click(voice.getByRole('button', { name: /Try again/ }));
    expect(checks.voice.retry).toHaveBeenCalledTimes(1);
    expect(checks.faceCount.retry).not.toHaveBeenCalled();
  });

  it('“Download models again” clears the saved models and restarts every check without a reload', async () => {
    lessonWith('faceCountDetection', 'voiceDetection');
    checks.voice.readiness = r({ state: 'failed', error: 'The download was interrupted.' });
    renderApp(lessonUrl);
    await setup();
    await userEvent.click(screen.getByRole('button', { name: /More fixes/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Download models again/ }));
    await waitFor(() => expect(checks.voice.retry).toHaveBeenCalled());
    expect(loader.clearProctoringCache).toHaveBeenCalled();
    expect(checks.faceCount.retry).toHaveBeenCalled();
  });

  it('opens diagnostics from the checklist without leaving the lesson', async () => {
    lessonWith('voiceDetection');
    checks.voice.readiness = r({ state: 'failed', error: 'Couldn’t reach the model server.' });
    renderApp(lessonUrl);
    await setup();
    await userEvent.click(screen.getByRole('button', { name: /Run diagnostics/ }));
    expect(await screen.findByRole('heading', { name: 'Check my device' })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Diagnostics results' })).toBeInTheDocument();
  });

  it('shows no setup and opens no camera in study mode', async () => {
    lessonWith('faceCountDetection', 'voiceDetection');
    renderApp(`${lessonUrl}?track=blue`);
    expect(await screen.findByRole('heading', { name: fixtures.itemBlog.item.name })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Proctoring setup' })).not.toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
