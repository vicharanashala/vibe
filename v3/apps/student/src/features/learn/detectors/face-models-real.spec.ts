import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import * as faceapi from '@vladmandic/face-api';

import { FACE_API_NETS } from '../proctoring/assets';

const require = createRequire(import.meta.url);

/**
 * The real face-api library accepts the files the loader hands it: each net's
 * weights manifest plus its weights file, decoded with face-api's own tfjs.
 * Uses the copies installed with the package (the same files the CDN serves).
 */
describe('face-api models from downloaded bytes', () => {
  it('loads all three nets with the real library', async () => {
    let dir = dirname(require.resolve('@vladmandic/face-api'));
    while (!dir.endsWith(join('node_modules', '@vladmandic', 'face-api'))) dir = dirname(dir);
    // jsdom has no WebGL, and face-api's bundled tfjs types leave these two out.
    const tf = faceapi.tf as unknown as { setBackend: (name: string) => Promise<boolean>; ready: () => Promise<void> };
    await tf.setBackend('cpu');
    await tf.ready();
    for (const { net, file } of FACE_API_NETS) {
      const manifest = JSON.parse(readFileSync(join(dir, 'model', `${file}-weights_manifest.json`), 'utf8')) as { weights: faceapi.tf.io.WeightsManifestEntry[] }[];
      const weights = new Uint8Array(readFileSync(join(dir, 'model', `${file}.bin`)));
      faceapi.nets[net].loadFromWeightMap(faceapi.tf.io.decodeWeights(weights.buffer, manifest.flatMap((g) => g.weights)));
      expect(faceapi.nets[net].isLoaded).toBe(true);
    }
  });
});
