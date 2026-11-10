import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelLoadError } from '../proctoring/model-loader';
import { useVoiceDetector } from './use-voice-detector';

const mediapipe = vi.hoisted(() => ({
  FilesetResolver: { isSimdSupported: vi.fn(async () => true) },
  AudioClassifier: { createFromOptions: vi.fn() },
}));
vi.mock('@mediapipe/tasks-audio', () => mediapipe);

const loader = vi.hoisted(() => ({ loadAssets: vi.fn() }));
vi.mock('../proctoring/model-loader', async (orig) => ({ ...(await orig<object>()), loadAssets: loader.loadAssets }));

const files = { 'wasm-loader': new Uint8Array(1), 'wasm-binary': new Uint8Array(2), model: new Uint8Array(3) };

beforeEach(() => {
  loader.loadAssets.mockReset();
  mediapipe.AudioClassifier.createFromOptions.mockReset();
  mediapipe.AudioClassifier.createFromOptions.mockResolvedValue({ close: vi.fn(), classify: vi.fn(() => []) });
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('useVoiceDetector loading', () => {
  it('downloads the runtime and model with progress, and starts the classifier from the saved bytes', async () => {
    let finish!: () => void;
    loader.loadAssets.mockImplementation((assets, onProgress) => {
      onProgress({ state: 'downloading', received: 5, total: 10 });
      expect(assets.map((a: { id: string }) => a.id)).toEqual(['wasm-loader', 'wasm-binary', 'model']);
      return new Promise((resolve) => (finish = () => resolve({ files, fromCache: false, saved: true })));
    });
    const { result } = renderHook(() => useVoiceDetector(null, true));
    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'downloading', received: 5, total: 10 }));

    await act(async () => finish());
    await waitFor(() => expect(result.current.readiness.state).toBe('ready'));
    expect(mediapipe.AudioClassifier.createFromOptions).toHaveBeenCalledWith(
      { wasmLoaderPath: 'blob:x', wasmBinaryPath: 'blob:x' },
      { baseOptions: { modelAssetBuffer: files.model } },
    );
  });

  it('uses the non-SIMD runtime on browsers without SIMD', async () => {
    mediapipe.FilesetResolver.isSimdSupported.mockResolvedValueOnce(false);
    loader.loadAssets.mockResolvedValue({ files, fromCache: true, saved: true });
    const { result } = renderHook(() => useVoiceDetector(null, true));
    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'ready', fromCache: true }));
    expect(loader.loadAssets.mock.calls[0][0][1].url).toContain('audio_wasm_nosimd_internal.wasm');
  });

  it('reports a failed download instead of silently turning the check off, and retries', async () => {
    loader.loadAssets.mockRejectedValueOnce(new ModelLoadError('network', 'Couldn’t reach the model server.'));
    const { result } = renderHook(() => useVoiceDetector(null, true));
    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'failed', error: 'Couldn’t reach the model server.' }));

    loader.loadAssets.mockResolvedValueOnce({ files, fromCache: false, saved: true });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.readiness.state).toBe('ready'));
  });

  it('reports a runtime that won’t start in this browser', async () => {
    loader.loadAssets.mockResolvedValue({ files, fromCache: false, saved: true });
    mediapipe.AudioClassifier.createFromOptions.mockRejectedValueOnce(new Error('WebAssembly.instantiate(): out of memory'));
    const { result } = renderHook(() => useVoiceDetector(null, true));
    await waitFor(() => expect(result.current.readiness.state).toBe('failed'));
    expect(result.current.readiness.error).toMatch(/up-to-date Chrome, Edge or Firefox/);
  });

  it('downloads nothing while the check is off', () => {
    const { result } = renderHook(() => useVoiceDetector(null, false));
    expect(loader.loadAssets).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ isSpeaking: false, readiness: { state: 'ready' } });
  });
});
