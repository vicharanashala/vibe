# Proposal

## Why

Some students can't get past proctoring on v3 lessons. The lesson stays dimmed behind "Turning your camera on…", "Checking it's you…" or a "Try again" dialog. Some wait a long time, and others only get through by switching browser or clearing their browser cache. Today v3 shows no loading progress, says nothing when a proctoring model fails to download, and gives students no way to find out what is wrong or to fix it themselves. So every case becomes a support request.

## What Changes

- **Proctoring setup screen**: while a proctored lesson is getting ready, students see a checklist of what it needs: camera, microphone, and each proctoring model the lesson uses. Each entry has a live status.
- **Accurate download progress**: each model shows real progress (MB downloaded of total, and percent) while it downloads. When it loads from the device instead, it says "Saved on this device". When the server doesn't report a size, it shows the MB downloaded so far instead of a fake percentage.
- **Saved models**: proctoring models and their runtime files are kept in a dedicated on-device cache after the first download, so later lessons start without downloading them again. The face-recognition model files are pinned to the app's installed library version instead of whatever version the CDN treats as latest.
- **Clear failures instead of endless waiting**: a model that fails or stops downloading is shown as failed or stalled, with a plain reason and next steps. A lesson no longer sits on "Checking it's you…" forever because a model never loaded.
- **Run diagnostics**: a button on the setup screen, and a standalone "Check my device" page, runs checks for:
  - browser features (WebGL, WebAssembly, workers, audio)
  - camera and microphone access and devices
  - whether each model host can be reached, and how fast
  - storage space
  - which models are saved
  - the app's own cached files

  It explains each problem in plain language with a fix, and the student can copy the report to send to support.
- **Self-service fixes**:
  - "Download models again": clears the saved proctoring models and fetches them fresh.
  - "Clear app files and reload": clears v3's own cached app files and its offline service worker, then reloads.
  - "Reload".

## Capabilities

### New Capabilities
- `v3/proctoring-readiness`: how the v3 student app gets a proctored lesson ready (camera, microphone and proctoring models), shows that progress, saves the models on the device, reports failures, runs device diagnostics, and lets students clear saved files and retry.

### Modified Capabilities
<!-- None: no existing spec covers v3 proctoring. -->

## Impact

- **v3 only** (`v3/apps/student`). No backend changes, and no change to the old frontend.
- **Detectors**: `features/learn/detectors/*` (face count, face recognition, gesture, voice) and `public/workers/gestureWorker.js` load their models through one shared loader instead of fetching directly from the CDNs.
- **Lesson page**: `features/learn/lesson-page.tsx` (`useProctoring`) and `camera-presence.tsx` gain the setup screen and its states.
- **New**:
  - a shared model loader with an on-device cache
  - a diagnostics module
  - a "Check my device" route, linked from the setup screen and the profile page
- **Service worker** (`public/sw.js`): "Clear app files" removes its caches. Its caching rules don't change.
- **External hosts**: the same as today (cdn.jsdelivr.net, storage.googleapis.com, tfhub.dev/Kaggle). Diagnostics reach them only when the student runs the checks.
- **No new dependencies.**
