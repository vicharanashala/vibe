import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { describeCameraIssue, useCameraPresence } from './camera-presence';

function failWith(name: string, devices: Partial<MediaDeviceInfo>[] = []) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => Promise.reject(new DOMException('nope', name))),
      enumerateDevices: vi.fn(async () => devices),
    },
  });
}

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('useCameraPresence reasons', () => {
  it('denied by the student or the browser', async () => {
    failWith('NotAllowedError');
    const { result } = renderHook(() => useCameraPresence({ audio: true }));
    await waitFor(() => expect(result.current.state).toBe('denied'));
    expect(result.current.reason).toEqual({ problem: 'denied', device: 'both' });
  });

  it('no microphone when only a camera is connected', async () => {
    failWith('NotFoundError', [{ kind: 'videoinput' }]);
    const { result } = renderHook(() => useCameraPresence({ audio: true }));
    await waitFor(() => expect(result.current.reason).toEqual({ problem: 'no-device', device: 'microphone' }));
    expect(result.current.state).toBe('off');
  });

  it('no camera when only a microphone is connected', async () => {
    failWith('NotFoundError', [{ kind: 'audioinput' }]);
    const { result } = renderHook(() => useCameraPresence({ audio: true }));
    await waitFor(() => expect(result.current.reason).toEqual({ problem: 'no-device', device: 'camera' }));
  });

  it('in use by another app', async () => {
    failWith('NotReadableError');
    const { result } = renderHook(() => useCameraPresence({ audio: false }));
    await waitFor(() => expect(result.current.reason).toEqual({ problem: 'busy', device: 'camera' }));
  });

  it('a camera that can’t do what the lesson asks', async () => {
    failWith('OverconstrainedError');
    const { result } = renderHook(() => useCameraPresence({ audio: true }));
    await waitFor(() => expect(result.current.reason).toEqual({ problem: 'unsupported', device: 'both' }));
  });

  it('a browser without camera access at all', async () => {
    const { result } = renderHook(() => useCameraPresence({ audio: true }));
    await waitFor(() => expect(result.current.reason).toEqual({ problem: 'unsupported', device: 'both' }));
  });
});

describe('describeCameraIssue', () => {
  it('gives each problem its own fix', () => {
    expect(describeCameraIssue({ problem: 'busy', device: 'camera' })).toEqual({
      title: 'Another app is using your camera',
      fix: expect.stringContaining('Close other apps'),
    });
    expect(describeCameraIssue({ problem: 'no-device', device: 'microphone' }).title).toBe('No microphone found');
    expect(describeCameraIssue({ problem: 'denied', device: 'both' }).fix).toMatch(/site/);
  });
});
