import { act, renderHook } from '@testing-library/react';
import { useEffect } from 'react';

import { ModelLoadError } from './model-loader';
import { describeLoadError, useReadiness } from './readiness';

describe('useReadiness', () => {
  it('walks a download through to ready', () => {
    const { result } = renderHook(() => useReadiness());
    expect(result.current.readiness.state).toBe('idle');

    act(() => result.current.track.begin());
    expect(result.current.readiness.state).toBe('checking');

    act(() => result.current.track.progress({ state: 'downloading', received: 100, total: 400 }));
    expect(result.current.readiness).toMatchObject({ state: 'downloading', received: 100, total: 400, fromCache: false });

    act(() => result.current.track.progress({ state: 'stalled', received: 100, total: 400 }));
    expect(result.current.readiness.state).toBe('stalled');

    act(() => result.current.track.loaded({ fromCache: false, saved: false }));
    expect(result.current.readiness).toMatchObject({ state: 'starting', saved: false });

    act(() => result.current.track.ready());
    expect(result.current.readiness.state).toBe('ready');
  });

  it('marks files loaded from the device', () => {
    const { result } = renderHook(() => useReadiness());
    act(() => result.current.track.progress({ state: 'cached', received: 400, total: 400 }));
    expect(result.current.readiness).toMatchObject({ state: 'starting', fromCache: true });
  });

  it('keeps a plain reason on failure, and retry re-runs only the dependent effect', () => {
    const runs: number[] = [];
    const { result } = renderHook(() => {
      const r = useReadiness();
      useEffect(() => void runs.push(r.attempt), [r.attempt]);
      return r;
    });
    act(() => result.current.track.fail(new ModelLoadError('network', 'Couldn’t reach the model server.')));
    expect(result.current.readiness).toMatchObject({ state: 'failed', error: 'Couldn’t reach the model server.' });

    act(() => result.current.retry());
    expect(runs).toEqual([0, 1]);
  });
});

describe('describeLoadError', () => {
  it('explains browser feature failures', () => {
    expect(describeLoadError(new Error('WebGL is not supported on this device'))).toMatch(/up-to-date Chrome, Edge or Firefox/);
    expect(describeLoadError('weird')).toBe('The check couldn’t start.');
  });
});
