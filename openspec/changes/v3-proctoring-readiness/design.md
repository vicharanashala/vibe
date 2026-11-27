# Design

## Context

The motivation is in proposal.md, and the required behaviour is in specs/v3/proctoring-readiness/spec.md.

How v3 proctoring loads today (`v3/apps/student/src/features/learn/`):

| Check | Code | Loads from | Ready/error signal today |
|---|---|---|---|
| Face count | `detectors/face-count-worker.ts` (module worker, tfjs + `@tensorflow-models/face-detection` 1.0.3) | `https://tfhub.dev/mediapipe/tfjs-model/face_detection/full/1`, which redirects to Kaggle storage | `MODEL_READY` / `ERROR` set a `ready` flag the UI never sees |
| Face recognition | `detectors/use-face-recognition.ts`, `face-enrollment.tsx` (`@vladmandic/face-api` 1.7.15, main thread) | `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model` (unpinned: whatever version jsdelivr serves as latest) | status stays `'loading'` (shown as "Checking it's you…"); a rejected load is never caught |
| Hand gesture | `public/workers/gestureWorker.js` (plain worker) | jsdelivr `@mediapipe/tasks-vision@0.10.3/+esm` and its `/wasm`, plus a model file on storage.googleapis.com | `INIT_SUCCESS` / `INIT_ERROR`, swallowed |
| Voice | `detectors/use-voice-detector.ts` (`@mediapipe/tasks-audio` 0.10.22-rc) | jsdelivr `/wasm` and the YAMNet model on storage.googleapis.com | no error handling: a failed load leaves voice detection off without saying so |
| Blur | `detectors/blur-worker.ts` | nothing to load (pixel maths) | none |

- **Camera:** `camera-presence.tsx` (`useCameraPresence`) has the states `starting | on | off | denied`. Every failure other than `NotAllowedError` becomes `off`, with a generic "Try again".
- **Blocking:** `lesson-page.tsx` `useProctoring` blocks the lesson only on the camera, enrolment, and face count/recognition results. Model loading isn't part of the decision, which is why a stuck model reads as a hang or a "Checking it's you…" that never ends.
- **Service worker:** `public/sw.js` caches same-origin hashed assets in `vibe-assets` and the shell in `vibe-shell-<version>`. It ignores cross-origin requests, so models rely on the browser's HTTP cache only.
- **Hosting:** the app's `_redirects` sets no Content-Security-Policy, so `blob:` URLs work for scripts and WASM.

The libraries already accept what we need:
- face-api: `faceapi.env.monkeyPatch({ fetch })`
- MediaPipe: `createFromModelBuffer` / `baseOptions.modelAssetBuffer`, and a `WasmFileset` that is a plain `{ wasmLoaderPath, wasmBinaryPath }` object, so blob URLs can be passed
- tfjs face-detection: `detectorModelUrl: string | io.IOHandler`

## Goals / Non-Goals

**Goals:**
- One loader that every proctoring model goes through, so progress, saving and errors are handled once and look the same everywhere.
- Model loading becomes a visible, separate state per check, part of the setup checklist.
- Everything works in a worker as well as on the main thread.

**Non-Goals:**
- Self-hosting models on ViBe's domain or a ViBe CDN. That would remove the third-party hosts, but it needs infrastructure and a separate change. Diagnostics will tell us whether host blocking is the main cause.
- Changing what each check detects, its thresholds, or incident reporting.
- Sending diagnostics to the backend. The report is copy-to-clipboard only, keeping this change frontend-only.
- Clearing the browser's HTTP cache, which a page can't do. The spec's "Clear app files" covers v3's own caches and service worker.

## Decisions

### 1. A shared model loader on the Cache Storage API
**Module:** `features/learn/proctoring/model-loader.ts` exports `loadAsset(asset, onProgress)`.

**Asset manifest:** each asset is a pinned URL, an id and an expected size (when known). A model is a group of assets, for example face-api's manifest plus its shards.

**How a load works:**
1. Open the cache `vibe-proctoring-v1` and look up the URL.
2. **Hit:** check that the body length matches the stored `Content-Length` (or the manifest size). If it does, report `cached` and return the bytes. If it doesn't, delete the entry and treat it as a miss.
3. **Miss:** `fetch` the file and read `response.body` with a reader, counting bytes. Report `{received, total}`, where `total` comes from `Content-Length`, or is `null` when absent (the spec's unknown-size case).
4. When the stream is complete, `cache.put` a clone. If storing fails (`QuotaExceededError`), report `not-saved` and still return the bytes.

**Stall detection:** the reader resets a 20-second timer on every chunk. When it fires, it reports `stalled` and keeps reading. The next chunk reports `downloading` again.

**Why Cache Storage over IndexedDB or the service worker:**
- It's available in workers and windows alike.
- It stores `Response` objects with their headers.
- It's what the service worker already uses, so "clear" is a single `caches.delete`.

A service-worker route for cross-origin models was rejected: the worker owns the network there, so the page can't see byte progress, and a broken service worker is one of the things students need to be able to clear.

### 2. Feeding saved bytes to each library
- **face-api (main thread):** `faceapi.env.monkeyPatch({ fetch: cachedFetch })`, where `cachedFetch` serves face-api's manifest and shard URLs through the loader. The model base URL is pinned to `@vladmandic/face-api@1.7.15/model`, matching `package.json`. This needs a test that it stays in sync.
- **MediaPipe voice (main thread):** the loader fetches `vision_wasm_internal.js`/`.wasm` (audio equivalents) and the `.tflite` model. The WASM files become blob URLs in a `WasmFileset`, and the model goes in through `modelAssetBuffer`.
- **Workers get finished files:** all downloads run on the main thread through the loader, where the readiness state lives, and the finished files are transferred to the workers as `ArrayBuffer`s in their `INIT` message (zero-copy). The workers never fetch models themselves, so there is no second copy of the loader and no `PROGRESS` message protocol.
- **MediaPipe gesture (`public/workers/gestureWorker.js`, kept as a classic worker because MediaPipe's WASM loader calls `importScripts`, which module workers lack):** it receives the pinned `vision_bundle.mjs` (the package's static file, not jsDelivr's generated `+esm`, whose bytes can change), the WASM files and the model. It imports the bundle from a blob URL, falling back to the CDN URL if that fails, and builds a `WasmFileset` from blob URLs.
- **tfjs face count (module worker):** it receives `model.json` and its weights, and passes an `io.IOHandler` built from them as `detectorModelUrl`.

The existing `MODEL_READY` / `INIT_SUCCESS` / `ERROR` messages remain the source of truth for ready and failed after the files arrive.

### 3. A readiness model that is separate from detection results
Each detector hook returns `{ result, readiness }`, where `readiness` is `{ state: 'idle' | 'checking' | 'downloading' | 'cached' | 'ready' | 'failed' | 'stalled' | 'not-saved', received, total, error? }`.

`useProctoring` builds the checklist from the enabled checks. It blocks the lesson while any enabled check isn't `ready`, adding to today's blocking rules rather than replacing them. Face recognition reports `failed` instead of staying in `'loading'`.

`retry(checkId)` restarts only that check: it re-runs that hook's load effect via a key bump, so the others are left alone.

Rejected: a single global progress bar. It can't say which check is broken, and the spec requires per-check status.

### 4. The setup checklist UI
`ProctoringSetup` replaces the current `CameraRequired` alert for proctored lessons. It is built from shadcn parts:
- `AlertDialog` for the frame
- an `Item` list with `Progress` for known sizes and an indeterminate `Progress` for unknown ones
- `Badge` for "Saved on this device"
- `Button`s for Try again, Run diagnostics and the menu of clear options
- a `DropdownMenu` or `Collapsible` for the advanced options

Camera errors are mapped from `DOMException.name`:

| Error | Shown as |
|---|---|
| `NotAllowedError` | denied |
| `NotFoundError` / `DevicesNotFoundError` | no device |
| `NotReadableError` / `TrackStartError` | busy |
| `OverconstrainedError` | unsupported |

`useCameraPresence` gains a `reason` field. Its `CameraState` values stay as they are, so other callers are unaffected.

### 5. Diagnostics are a pure function plus a page
`features/learn/proctoring/diagnostics.ts` exports `runDiagnostics(): AsyncIterable<CheckResult>`, which yields results as they finish so the UI fills in progressively.

**Checks:**
- WebGL2/WebGL: canvas context
- WebAssembly: `WebAssembly.validate` on a tiny module
- `Worker` / `OffscreenCanvas` / `AudioContext` / `caches` / `isSecureContext`
- `navigator.permissions.query` for camera and microphone, where supported
- `enumerateDevices` counts
- `navigator.storage.estimate()`
- for each model host, a `fetch` with `cache: 'no-store'` of a small pinned file (a model manifest or the WASM loader JS), with an 8-second timeout, recording reachable/latency/throughput
- what is saved in `vibe-proctoring-v1`, and service worker registration state
- browser name and version, from `navigator.userAgentData` with a userAgent fallback

The camera is not opened in diagnostics unless it is already open. Using permission state and the device list avoids a new permission prompt.

**Report:** a plain-text formatter. The clipboard copy goes through `navigator.clipboard.writeText`, with a sonner toast to confirm.

**Page:** `/check-device`, a new route under the signed-in app layout, linked from the profile page and from the setup checklist. The same component renders inline in the checklist as a `Sheet`.

### 6. Clear options
- **Download models again:**
  1. `caches.delete('vibe-proctoring-v1')`
  2. reset the in-memory loaded promises (`loadFaceModels` is memoised today and gets a reset)
  3. terminate and restart the detector workers through the readiness retry for every check

  No page reload is needed.
- **Clear app files and reload:**
  1. delete every cache whose name starts with `vibe-` (shell, assets, proctoring)
  2. `navigator.serviceWorker.getRegistrations()` → `unregister()`
  3. `location.reload()`

  Firebase sign-in lives in IndexedDB, and other settings live in localStorage, so neither is touched. A confirm dialog lists what will be removed.
- **Reload:** `location.reload()`.

## Risks / Trade-offs

- **[Risk] A blob-URL import of the MediaPipe `vision_bundle.mjs` fails (it has no imports of its own, so this is unlikely)** → Fall back to importing the CDN URL directly, so it is no worse than today, and the step is covered by a manual check in tasks. If it can't work, the gesture loader JS keeps loading from the CDN, with progress shown only for its WASM and model.
- **[Risk] tfhub.dev redirects to Kaggle with no CORS `Content-Length` header** → Already covered by the unknown-size UI.
- **[Risk] A pinned version drifts from `package.json` after a dependency bump** → A unit test reads the installed package versions and compares them with the pinned URLs.
- **[Risk] Cache Storage is unavailable (some private-browsing modes, or an insecure context)** → The loader falls back to plain fetch with progress and reports `not-saved`. Diagnostics flags this as a warning.
- **[Risk] Byte counting slows downloads** → Reading chunks is how `fetch` delivers data anyway. Only a counter and a callback are added, throttled to about 10 updates per second.
- **[Trade-off] The models still come from third-party hosts** → Out of scope here (see Non-Goals). The diagnostics report will show whether host blocking is common enough to justify self-hosting.

## Migration Plan

There's no data migration. Ship with the next `deploy-frontend-v3`.

On first load after deploy:
- every student downloads the models once into the new cache, and sees real progress while doing so
- students with stale service worker files have the "Clear app files" option

Rollback is a redeploy of the previous build. The extra `vibe-proctoring-v1` cache is harmless, and later the browser can evict it.

## Open Questions

- Exact sizes for the manifest, so a total can be shown before the first response arrives. These can be measured during implementation, and response headers are used meanwhile.
