import { act, renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loader = vi.hoisted(() => ({ loadAssets: vi.fn() }));
vi.mock('../proctoring/model-loader', async (orig) => ({ ...(await orig<object>()), loadAssets: loader.loadAssets }));

import { ModelLoadError } from '../proctoring/model-loader';
import { useFaceCountDetector } from './use-face-count-detector';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  posted: { message: unknown; transfer?: Transferable[] }[] = [];
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: unknown, transfer?: Transferable[]) {
    this.posted.push({ message, transfer });
  }
  emit(data: unknown) {
    act(() => this.onmessage?.({ data } as MessageEvent));
  }
}

const files = () => ({ model: new Uint8Array([123]), weights: new Uint8Array(8) });
const video = createRef<HTMLVideoElement>();

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  loader.loadAssets.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('useFaceCountDetector loading', () => {
  it('downloads the model with progress, hands the files to the worker, and is ready when it starts', async () => {
    let finish!: () => void;
    loader.loadAssets.mockImplementation((_assets, onProgress) => {
      onProgress({ state: 'downloading', received: 600_000, total: 1_223_027 });
      return new Promise((resolve) => (finish = () => resolve({ files: files(), fromCache: false, saved: true })));
    });
    const { result } = renderHook(() => useFaceCountDetector(video, true));
    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'downloading', received: 600_000 }));
    expect(FakeWorker.instances).toHaveLength(0);

    await act(async () => finish());
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    const worker = FakeWorker.instances[0];
    const init = worker.posted[0];
    expect(init.message).toMatchObject({ type: 'INIT', files: { model: expect.any(ArrayBuffer), weights: expect.any(ArrayBuffer) } });
    expect(init.transfer).toHaveLength(2);
    expect(result.current.readiness.state).toBe('starting');

    worker.emit({ type: 'MODEL_READY' });
    expect(result.current.readiness.state).toBe('ready');
    worker.emit({ type: 'DETECTION_RESULT', faceCount: 2 });
    expect(result.current.faceCount).toBe(2);
  });

  it('fails when the worker can’t start the model, but not for a later frame error', async () => {
    loader.loadAssets.mockResolvedValue({ files: files(), fromCache: true, saved: true });
    const { result } = renderHook(() => useFaceCountDetector(video, true));
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    FakeWorker.instances[0].emit({ type: 'ERROR', message: 'Error: WebGL is not supported' });
    expect(result.current.readiness.state).toBe('failed');
    expect(result.current.readiness.error).toMatch(/up-to-date Chrome/);

    act(() => result.current.retry());
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalled();
    const second = FakeWorker.instances[1];
    second.emit({ type: 'MODEL_READY' });
    second.emit({ type: 'ERROR', message: 'Canvas context unavailable' });
    expect(result.current.readiness).toMatchObject({ state: 'ready', fromCache: true });
  });

  it('reports a failed download', async () => {
    loader.loadAssets.mockRejectedValue(new ModelLoadError('http', 'The model server answered with an error (404).'));
    const { result } = renderHook(() => useFaceCountDetector(video, true));
    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'failed', error: 'The model server answered with an error (404).' }));
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('does nothing while the check is off', () => {
    const { result } = renderHook(() => useFaceCountDetector(video, false));
    expect(loader.loadAssets).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ faceCount: null, readiness: { state: 'ready' } });
  });
});
