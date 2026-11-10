import { act, renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelLoadError } from '../proctoring/model-loader';
import { resetFaceModels, useFaceRecognition } from './use-face-recognition';

const faceapi = vi.hoisted(() => ({
  nets: {
    tinyFaceDetector: { loadFromWeightMap: vi.fn() },
    faceLandmark68Net: { loadFromWeightMap: vi.fn() },
    faceRecognitionNet: { loadFromWeightMap: vi.fn() },
  },
  tf: { io: { decodeWeights: vi.fn(() => ({})) } },
}));
vi.mock('@vladmandic/face-api', () => faceapi);

const loader = vi.hoisted(() => ({ loadAssets: vi.fn() }));
vi.mock('../proctoring/model-loader', async (orig) => ({ ...(await orig<object>()), loadAssets: loader.loadAssets }));

const manifest = new TextEncoder().encode(JSON.stringify([{ paths: ['x.bin'], weights: [{ name: 'w', shape: [1], dtype: 'float32' }] }]));
function files() {
  const out: Record<string, Uint8Array> = {};
  for (const f of ['tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model']) {
    out[`${f}-manifest`] = manifest;
    out[`${f}-weights`] = new Uint8Array(4);
  }
  return out;
}

const video = createRef<HTMLVideoElement>();
const embedding = Array(128).fill(0);

beforeEach(() => {
  resetFaceModels();
  loader.loadAssets.mockReset();
  Object.values(faceapi.nets).forEach((n) => n.loadFromWeightMap.mockClear());
});

describe('useFaceRecognition model loading', () => {
  it('reports download progress, then loads every net from the downloaded files', async () => {
    let finish!: () => void;
    loader.loadAssets.mockImplementation((_assets, onProgress) => {
      onProgress({ state: 'downloading', received: 1_048_576, total: 4_194_304 });
      return new Promise((resolve) => (finish = () => resolve({ files: files(), fromCache: false, saved: true })));
    });
    const { result } = renderHook(() => useFaceRecognition(video, embedding, true));

    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'downloading', received: 1_048_576, total: 4_194_304 }));
    expect(result.current.status).toBe('loading');

    await act(async () => finish());
    await waitFor(() => expect(result.current.readiness.state).toBe('ready'));
    expect(result.current.readiness.fromCache).toBe(false);
    for (const net of Object.values(faceapi.nets)) expect(net.loadFromWeightMap).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('no-face');
  });

  it('says when the models came from the device', async () => {
    loader.loadAssets.mockImplementation(async (_assets, onProgress) => {
      onProgress({ state: 'cached', received: 10, total: 10 });
      return { files: files(), fromCache: true, saved: true };
    });
    const { result } = renderHook(() => useFaceRecognition(video, embedding, true));
    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'ready', fromCache: true }));
  });

  it('fails with a reason instead of checking forever, and retry loads again', async () => {
    loader.loadAssets.mockRejectedValueOnce(new ModelLoadError('network', 'Couldn’t reach the model server.'));
    const { result } = renderHook(() => useFaceRecognition(video, embedding, true));
    await waitFor(() => expect(result.current.readiness).toMatchObject({ state: 'failed', error: 'Couldn’t reach the model server.' }));
    expect(result.current.status).toBe('loading');

    loader.loadAssets.mockResolvedValueOnce({ files: files(), fromCache: false, saved: true });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.readiness.state).toBe('ready'));
    expect(loader.loadAssets).toHaveBeenCalledTimes(2);
  });

  it('downloads the models before a reference photo exists, for the photo capture', async () => {
    loader.loadAssets.mockResolvedValue({ files: files(), fromCache: false, saved: true });
    const { result } = renderHook(() => useFaceRecognition(video, undefined, true));
    await waitFor(() => expect(result.current.readiness.state).toBe('ready'));
    expect(result.current.status).toBe('loading');
  });

  it('loads nothing and counts as ready while the check is off', () => {
    const { result } = renderHook(() => useFaceRecognition(video, embedding, false));
    expect(loader.loadAssets).not.toHaveBeenCalled();
    expect(result.current.readiness.state).toBe('ready');
  });
});
