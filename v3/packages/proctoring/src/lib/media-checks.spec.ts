import { detectVirtualCamera, inspectStreamQuality, isSuspiciousCameraLabel, runMediaChecks } from './media-checks.js';

function fakeStream(label: string, settings: Partial<MediaTrackSettings> = {}): MediaStream {
  const track = { label, getSettings: () => ({ width: 1280, height: 720, frameRate: 30, ...settings }) };
  return { getVideoTracks: () => [track] } as unknown as MediaStream;
}

describe('media checks', () => {
  it.each(['OBS Virtual Camera', 'Snap Camera', 'ManyCam Video Source', 'NVIDIA Broadcast'])(
    'flags %s as a virtual camera',
    (label) => {
      expect(isSuspiciousCameraLabel(label)).toBe(true);
      expect(detectVirtualCamera(fakeStream(label))).toMatchObject({ isVirtual: true, confidence: 'high' });
    },
  );

  it('accepts an ordinary webcam', () => {
    expect(runMediaChecks(fakeStream('FaceTime HD Camera'))).toEqual([]);
  });

  it('flags implausible resolutions and frame rates', () => {
    expect(inspectStreamQuality(fakeStream('Webcam', { frameRate: 120 })).isSuspicious).toBe(true);
    expect(inspectStreamQuality(fakeStream('Webcam', { width: 7680, height: 4320 })).isSuspicious).toBe(true);
  });

  it('reports both violations together', () => {
    const types = runMediaChecks(fakeStream('OBS Virtual Camera', { frameRate: 240 })).map((v) => v.type);
    expect(types).toEqual(['VIRTUAL_CAMERA', 'CAMERA_QUALITY']);
  });

  it('treats a missing stream as nothing to report', () => {
    expect(runMediaChecks(null)).toEqual([]);
  });
});
