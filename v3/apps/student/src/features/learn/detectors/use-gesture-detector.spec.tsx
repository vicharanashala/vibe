import { act, renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelLoadError } from '../proctoring/model-loader';
import { useGestureDetector } from './use-gesture-detector';

const loader = vi.hoisted(() => ({ loadAssets: vi.fn() }));
vi.mock('../proctoring/model-loader', async (orig) => ({ ...(await orig<object>()), loadAssets: loader.loadAssets }));

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  posted: { message: { type: string; files?: Record<string, ArrayBuffer>; urls?: { library: string } }; transfer?: Transferable[] }[] = [];
  terminate = vi.fn();
  constructor(readonly url: string) {
    FakeWorker.instances.push(this);
  }
  postMessage(message: FakeWorker['posted'][number]['message'], transfer?: Transferable[]) {
    this.posted.push({ message, transfer });
  }
  emit(data: unknown) {
    act(() => this.onmessage?.({ data } as MessageEvent));
  }
}

const files = () => ({
  library: new Uint8Array(1),
  'wasm-loader': new Uint8Array(2),
  'wasm-binary': new Uint8Array(3),
  model: new Uint8Array(4),
});
const video = createRef<HTMLVideoElement>();

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  loader.loadAssets.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('useGestureDetector loading', () => {
  it('downloads MediaPipe’s files with progress and hands all four to the classic worker', async () => {
    let finish!: () => void;
    loader.loadAssets.mockImplementation((assets, onProgress) => {
      expect(assets.map((a: { id: string }) => a.id)).toEqual(['library', 'wasm-loader', 'wasm-binary', 'model']);
      onProgress({ state: 'stalled', received: 1_000_000, total: 18_150_000 });
      return new Promise((resolve) => (finish = () => resolve({ files: files(), fromCache: false, saved: false })));
    });
    const { result } = renderHook(() => useGestureDetector(video, true));
    await waitFor(() => expect(result.current.readiness.state).toBe('stalled'));

    await act(async () => finish());
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    const worker = FakeWorker.instances[0];
    expect(worker.url).toBe('/workers/gestureWorker.js');
    const { message, transfer } = worker.posted[0];
    expect(message.type).toBe('INIT');
    expect(Object.keys(message.files!)).toEqual(['library', 'wasmLoader', 'wasmBinary', 'model']);
    expect(message.urls!.library).toMatch(/@mediapipe\/tasks-vision@0\.10\.3\/vision_bundle\.mjs$/);
    expect(transfer).toHaveLength(4);

    worker.emit({ type: 'INIT_SUCCESS' });
    expect(result.current.readiness).toMatchObject({ state: 'ready', saved: false });
    worker.emit({ type: 'GESTURE_RESULT', gesture: 'Thumb_Up', confidence: 0.9 });
    expect(result.current.gesture).toBe('Thumb_Up');
  });

  it('reports a worker that can’t start, and retries', async () => {
    loader.loadAssets.mockResolvedValue({ files: files(), fromCache: true, saved: true });
    const { result } = renderHook(() => useGestureDetector(video, true));
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    FakeWorker.instances[0].emit({ type: 'INIT_ERROR', error: 'WebAssembly.instantiate failed' });
    expect(result.current.readiness.state).toBe('failed');

    act(() => result.current.retry());
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    FakeWorker.instances[1].emit({ type: 'INIT_SUCCESS' });
    expect(result.current.readiness).toMatchObject({ state: 'ready', fromCache: true });
  });

  it('reports a failed download', async () => {
    loader.loadAssets.mockRejectedValue(new ModelLoadError('interrupted', 'The download was interrupted.'));
    const { result } = renderHook(() => useGestureDetector(video, true));
    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'failed', error: 'The download was interrupted.' }));
  });

  it('does nothing while the check is off', () => {
    const { result } = renderHook(() => useGestureDetector(video, false));
    expect(loader.loadAssets).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ gesture: null, readiness: { state: 'ready' } });
  });
});
