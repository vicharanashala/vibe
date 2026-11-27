import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import {
  FACE_API_VERSION,
  FACE_DETECTION_MODEL,
  TASKS_AUDIO_VERSION,
  faceCountAssets,
  faceRecognitionAssets,
  gestureAssets,
  voiceAssets,
} from './assets';

const require = createRequire(import.meta.url);

/** The installed package's own package.json (some block `pkg/package.json` via "exports"). */
function installed(pkg: string): { version: string } {
  let dir = dirname(require.resolve(pkg));
  while (!dir.endsWith(join('node_modules', ...pkg.split('/')))) dir = dirname(dir);
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

describe('proctoring model assets', () => {
  it('pins face-api model files to the installed library version', () => {
    expect(installed('@vladmandic/face-api').version).toBe(FACE_API_VERSION);
    for (const asset of faceRecognitionAssets()) expect(asset.url).toContain(`@vladmandic/face-api@${FACE_API_VERSION}/model/`);
  });

  it('pins the voice runtime to the installed tasks-audio version', () => {
    expect(installed('@mediapipe/tasks-audio').version).toBe(TASKS_AUDIO_VERSION);
    for (const simd of [true, false])
      for (const asset of voiceAssets(simd).filter((a) => a.id.startsWith('wasm')))
        expect(asset.url).toContain(`@mediapipe/tasks-audio@${TASKS_AUDIO_VERSION}/wasm/`);
  });

  it('loads the same face-detection model the installed library defaults to', () => {
    const lib = readFileSync(
      join(dirname(require.resolve('@tensorflow-models/face-detection')), 'face-detection.esm.js'),
      'utf8',
    );
    expect(lib).toContain(`"${FACE_DETECTION_MODEL}"`);
    expect(faceCountAssets().every((a) => a.url.startsWith(FACE_DETECTION_MODEL))).toBe(true);
  });

  it('gives every file a unique id and a size within each check', () => {
    for (const list of [faceRecognitionAssets(), faceCountAssets(), voiceAssets(true), voiceAssets(false), gestureAssets(true), gestureAssets(false)]) {
      expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
      expect(list.every((a) => typeof a.size === 'number' && a.size > 0)).toBe(true);
    }
  });
});
