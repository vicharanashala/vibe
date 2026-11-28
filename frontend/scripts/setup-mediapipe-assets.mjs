/**
 * Copies the @mediapipe/tasks-vision WASM runtime and downloads the face
 * detector model into public/mediapipe/, so both are self-hosted and served
 * from the app's own origin (no external CDN dependency at runtime for
 * proctoring - see FaceDetectorWorker.ts, #1222).
 *
 * Runs automatically on `npm install` (see package.json postinstall).
 * Safe to re-run - skips anything already present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PKG_ROOT = path.join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision');
const WASM_SRC = path.join(PKG_ROOT, 'wasm');
const WASM_DEST = path.join(ROOT, 'public', 'mediapipe', 'wasm');
const MODEL_DEST = path.join(ROOT, 'public', 'mediapipe', 'models', 'blaze_face_short_range.tflite');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

function copyWasmFiles() {
  if (!fs.existsSync(WASM_SRC)) {
    console.warn(`[setup-mediapipe-assets] ${WASM_SRC} not found - is @mediapipe/tasks-vision installed?`);
    return;
  }
  fs.mkdirSync(WASM_DEST, { recursive: true });
  for (const name of fs.readdirSync(WASM_SRC)) {
    const dest = path.join(WASM_DEST, name);
    if (fs.existsSync(dest)) continue;
    fs.copyFileSync(path.join(WASM_SRC, name), dest);
    console.log(`[setup-mediapipe-assets] copied ${name}`);
  }
}

function downloadModel() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(MODEL_DEST)) {
      resolve();
      return;
    }
    fs.mkdirSync(path.dirname(MODEL_DEST), { recursive: true });
    console.log(`[setup-mediapipe-assets] downloading ${MODEL_URL}`);
    const tmpDest = `${MODEL_DEST}.tmp`;
    fs.mkdirSync(path.dirname(MODEL_DEST), { recursive: true });

    const file = fs.createWriteStream(tmpDest);
    const cleanup = (err) => {
      try { file.destroy(); } catch {}
      try { fs.unlinkSync(tmpDest); } catch {}
      reject(err);
    };

    https
      .get(MODEL_URL, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          cleanup(new Error(`Model download failed: HTTP ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        res.on('error', cleanup);
        file.on('error', cleanup);
        file.on('finish', () =>
          file.close(() => {
            fs.renameSync(tmpDest, MODEL_DEST);
            resolve();
          })
        );
      })
      .on('error', cleanup);
  });
}

async function main() {
  copyWasmFiles();
  await downloadModel();
  console.log('[setup-mediapipe-assets] done');
}

main().catch((err) => {
  console.error('[setup-mediapipe-assets] FAILED:', err.message);
  // Non-fatal: don't break `npm install` for other contributors who don't
  // touch proctoring - the worker will just fail to init at runtime until
  // this is re-run.
  process.exit(0);
});
