import { renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';

import { api, resetSession } from '@/test/session';

import {
  REPORT_COOLDOWN_MS,
  reportIncident,
  useIncidentReporter,
  type ReportedIncident,
} from './incident-reporter';

vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const RECORD = '/api/anomalies/record/image';
const target = { courseId: 'c1', versionId: 'v1', itemId: 'i1' };
const video = createRef<HTMLVideoElement>();

/** The multipart body of the nth report. */
const sent = (n: number) =>
  api.POST.mock.calls
    .filter((c) => c[0] === RECORD)
    [n][1].bodySerializer() as FormData;
const reports = () => api.POST.mock.calls.filter((c) => c[0] === RECORD).length;

function setup(initial: Partial<Record<ReportedIncident, boolean>>) {
  return renderHook(
    ({ active }) => useIncidentReporter(target, video, active, true),
    { initialProps: { active: initial } },
  );
}

beforeEach(() => resetSession());
afterEach(() => vi.useRealTimers());

describe('reportIncident', () => {
  it('sends the incident with its photo', async () => {
    await reportIncident(
      target,
      'NO_FACE',
      new Blob(['x'], { type: 'image/jpeg' }),
    );
    const form = sent(0);
    expect(
      Object.fromEntries(
        [...form.entries()].map(([k, v]) => [
          k,
          typeof v === 'string' ? v : 'file',
        ]),
      ),
    ).toEqual({
      type: 'NO_FACE',
      courseId: 'c1',
      versionId: 'v1',
      itemId: 'i1',
      image: 'file',
    });
  });

  it('still records the incident when the photo can’t be saved', async () => {
    api.POST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'storage' },
      response: new Response(null, { status: 500 }),
    });
    await reportIncident(target, 'NO_FACE', new Blob(['x']));
    expect(reports()).toBe(2);
    expect(sent(1).has('image')).toBe(false);
  });
});

describe('useIncidentReporter', () => {
  it('reports once when an incident starts, not on every render while it lasts', async () => {
    const { rerender } = setup({ NO_FACE: false });
    expect(reports()).toBe(0);
    rerender({ active: { NO_FACE: true } });
    await waitFor(() => expect(reports()).toBe(1));
    rerender({ active: { NO_FACE: true } });
    expect(sent(0).get('type')).toBe('NO_FACE');
    expect(reports()).toBe(1);
  });

  it('waits out the cooldown before reporting the same incident again', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { rerender } = setup({ NO_FACE: true });
    await waitFor(() => expect(reports()).toBe(1));
    rerender({ active: { NO_FACE: false } });
    rerender({ active: { NO_FACE: true } });
    await Promise.resolve();
    expect(reports()).toBe(1);

    now.mockReturnValue(1_000_000 + REPORT_COOLDOWN_MS);
    rerender({ active: { NO_FACE: false } });
    rerender({ active: { NO_FACE: true } });
    await waitFor(() => expect(reports()).toBe(2));
    now.mockRestore();
  });

  it('sends voice incidents without a photo', async () => {
    setup({ VOICE_DETECTION: true });
    await waitFor(() => expect(reports()).toBe(1));
    expect(sent(0).get('type')).toBe('VOICE_DETECTION');
    expect(sent(0).has('image')).toBe(false);
  });
});
