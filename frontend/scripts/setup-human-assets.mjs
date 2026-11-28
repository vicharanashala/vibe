/**
 * Copies the @vladmandic/human runtime (the "script" build, for importScripts()
 * in a classic worker - see humanFaceWorker.js) and the three model pairs it
 * actually needs (face detector, mesh, description/embeddings) into
 * public/models/human/, so proctoring doesn't depend on Human's default CDN
 * at runtime - same reasoning as setup-mediapipe-assets.mjs.
 *
 * Runs automatically on `npm install` (see package.json postinstall).
 * Safe to re-run - skips anything already present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PKG_ROOT = path.join(ROOT, 'node_modules', '@vladmandic', 'human');
const DEST = path.join(ROOT, 'public', 'models', 'human');

const FILES = [
  ['dist/human.js', 'human.js'],
  ['models/blazeface.json', 'blazeface.json'],
  ['models/blazeface.bin', 'blazeface.bin'],
  ['models/facemesh.json', 'facemesh.json'],
  ['models/facemesh.bin', 'facemesh.bin'],
  ['models/faceres.json', 'faceres.json'],
  ['models/faceres.bin', 'faceres.bin'],
];

function copyFiles() {
  if (!fs.existsSync(PKG_ROOT)) {
    console.warn(`[setup-human-assets] ${PKG_ROOT} not found - is @vladmandic/human installed?`);
    return;
  }
  fs.mkdirSync(DEST, { recursive: true });
  for (const [src, destName] of FILES) {
    const srcPath = path.join(PKG_ROOT, src);
    const destPath = path.join(DEST, destName);
    if (fs.existsSync(destPath)) continue;
    if (!fs.existsSync(srcPath)) {
      console.warn(`[setup-human-assets] ${srcPath} not found, skipping`);
      continue;
    }
    fs.copyFileSync(srcPath, destPath);
    console.log(`[setup-human-assets] copied ${destName}`);
  }
}

function main() {
  copyFiles();
  console.log('[setup-human-assets] done');
}

try {
  main();
} catch (err) {
  console.error('[setup-human-assets] FAILED:', err.message);
  // Non-fatal: don't break `npm install` for other contributors who don't
  // touch proctoring - the worker will just fail to init at runtime until
  // this is re-run.
}
