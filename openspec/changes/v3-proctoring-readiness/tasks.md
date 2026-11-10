# Tasks

All commands run from `v3/`. Each group's checks: `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`.

## 1. Model loader and on-device cache

- [x] 1.1 Add `features/learn/proctoring/assets.ts` with the pinned asset manifest (ids, URLs pinned to the installed versions of face-api 1.7.15, tasks-audio 0.10.22-rc, tasks-vision 0.10.3 and the tfhub face-detection full/1, plus known sizes where available) and a spec that reads the installed `package.json` versions and fails if a pinned URL drifts; verify the spec passes
- [x] 1.2 Implement `features/learn/proctoring/model-loader.ts` (`loadAsset`: Cache Storage `vibe-proctoring-v1` lookup with a length check, a streamed fetch with byte progress, `total: null` when there is no Content-Length, `cache.put` after a complete download, `not-saved` on a quota error, and plain fetch when `caches` is unavailable); verify with Vitest specs using a fake `caches` and a stubbed ReadableStream: cached hit, miss with known size, unknown size, damaged entry re-downloaded, quota error
- [x] 1.3 Add stall detection (20 s with no chunk → `stalled`, back to `downloading` on the next chunk) and progress throttling (about 10 updates/s) to the loader; verify with fake-timer specs
- [x] 1.4 Add `clearProctoringCache()` and `clearAppFiles()` (delete `vibe-*` caches, unregister service workers) with specs asserting that only `vibe-` caches are deleted and localStorage/IndexedDB are untouched

## 2. Detectors load through the loader and report readiness

- [x] 2.1 Define the `Readiness` type and a `useReadiness` helper (state, received, total, error, `retry`) in `features/learn/proctoring/readiness.ts`; verify with a hook spec for the state transitions and retry
- [x] 2.2 Face recognition: route face-api through `faceapi.env.monkeyPatch({ fetch })` backed by the loader, pin the model URL, make `loadFaceModels` resettable, catch load failures, and return `{ status, readiness }` (no "Checking it's you…" before the models load); update `face-enrollment.tsx` to show the same progress; verify specs for progress, cached, failed and retry, and that the existing face-recognition specs still pass
- [x] 2.3 Voice: load the WASM fileset and YAMNet through the loader (blob-URL `WasmFileset` and `modelAssetBuffer`), handle failures, and return `{ isSpeaking, readiness }`; verify with a spec that mocks `@mediapipe/tasks-audio`
- [x] 2.4 Face count: load `model.json` and its weights through the loader on the main thread, transfer them to the worker in `INIT`, build an `io.IOHandler` from them for `detectorModelUrl`, and have `useFaceCountDetector` return `{ faceCount, readiness }`; verify with a hook spec using a fake Worker (download progress, MODEL_READY, ERROR)
- [x] 2.5 Gesture: load the pinned `vision_bundle.mjs`, WASM and model through the loader on the main thread and transfer them to `public/workers/gestureWorker.js` (still a classic worker), which imports the bundle from a blob URL with a CDN fallback; have `useGestureDetector` return `{ gesture, readiness }`; verify with a fake-Worker hook spec, and check by hand in Chrome that the blob import works (record the result in the PR)
- [x] 2.6 Camera: add a `reason` to `useCameraPresence` (denied / no-device / busy / unsupported, mapped from `DOMException.name`) without changing `CameraState`; verify one spec per reason

## 3. Setup checklist in the lesson

- [x] 3.1 Build `ProctoringSetup` (shadcn AlertDialog, Item, Progress with known and indeterminate sizes, Badge "Saved on this device", Buttons) that renders one entry per enabled check, with MB/percent text, stalled/failed reasons, and per-entry Try again; verify with Testing Library specs for each state, including an unknown size showing MB without a percentage
- [x] 3.2 Wire it into `useProctoring` in `lesson-page.tsx`: build the entries from the enabled detectors, block while any entry isn't ready (in addition to today's rules), close when all are ready, and replace `CameraRequired` for proctored lessons; verify lesson specs: only the camera listed when only cameraMic is on, all-ready unblocks, a failed model keeps the checklist open, and study mode shows nothing
- [x] 3.3 Add the clear menu to the checklist (Download models again → clears and restarts every check without a reload; Clear app files and reload → confirm dialog listing what is removed; Reload); verify specs for both clear paths with the loader mocked

## 4. Diagnostics

- [x] 4.1 Implement `features/learn/proctoring/diagnostics.ts` (`runDiagnostics` async iterable: browser features, camera/mic permission and device counts, host reachability with an 8 s timeout and latency, storage estimate, saved models, service worker state, browser and version) and `formatReport`; verify specs with stubbed browser APIs for pass/warning/fail per check, and that the report contains no image, sound or token data
- [x] 4.2 Build the diagnostics view (results filling in as they arrive, a plain-language fix per warning/fail, Copy report with a sonner toast, the same clear options) and open it from the checklist's Run diagnostics as a Sheet; verify Testing Library specs
- [x] 4.3 Add the `/check-device` route ("Check my device") under the signed-in layout, and a link to it from the profile page; verify a router spec, and that the profile page link navigates there

## 5. Integration check

- [ ] 5.1 Run the full v3 checks (`npx vitest run --root apps/student --maxWorkers=2`, tsc, and `NX_DAEMON=false npx nx run-many -t lint typecheck --projects=student --parallel=1`) and confirm they pass
- [ ] 5.2 Manually in the local stack (v3 :4310 against the backend :4002) on a proctored lesson with every detector on: the first visit shows real download progress per model; a reload shows every model as "Saved on this device"; blocking jsdelivr in DevTools shows Failed and diagnostics names the host; "Download models again" re-downloads with progress; "Clear app files and reload" keeps the student signed in. Record the results in the PR

## Workflow follow-up

- Merge, then `deploy-frontend-v3`.
- Archive the change after the deploy, syncing `v3/proctoring-readiness` into the main specs.
