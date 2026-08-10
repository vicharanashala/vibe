# Media Module — Uploaded Video & HLS Streaming

> **Status:** Active. Instructor-facing flow verified end to end against the live
> cloud project. Two infrastructure items remain before production — see
> [Deployment](#deployment).

Lets instructors **upload their own lecture videos** to ViBe and stream them to
learners, alongside the existing YouTube links. A lecture is uploaded once into a
per-course library and reused across as many lessons as needed, each playing its own
time range.

---

## How it fits together

```
Instructor's browser                ViBe backend                   Google Cloud
────────────────────                ────────────                   ────────────
  "give me an upload URL"  ──────▶  reserve asset (UPLOADING)
                                    sign a PUT URL          ──────▶
  PUT the file  ────────────────────────────────────────────▶  raw bucket
                                                                    │
                                                              Cloud Function
                                                                    │
                                                              Transcoder ──▶ HLS
                                                                              │
  "is it ready?"  ───────────────▶  probe stream bucket  ◀────────────────────┘
                                    playlist found → READY

Learner presses play  ─────────▶  check enrollment
                                  sign a time-boxed URL  ──────▶  player streams
```

Two properties worth preserving:

- **Bytes never transit ViBe.** The backend only ever signs URLs, so a 2 GB lecture
  costs one signature rather than a long-lived request.
- **`READY` is only ever derived from an observed playlist**, never asserted by a
  client. A browser can claim it finished uploading; it cannot make a video playable.

---

## Backend files

| File | Purpose |
|---|---|
| `classes/transformers/VideoAsset.ts` | The asset model and its lifecycle states (`UPLOADING → PROCESSING → READY / FAILED`) |
| `classes/validators/VideoAssetValidator.ts` | Request/response DTOs — upload body, list query, update body |
| `repositories/providers/mongodb/VideoAssetRepository.ts` | Mongo access, search, indexes, and the "is any lesson using this?" check |
| `services/VideoAssetService.ts` | The decisions: who may upload, who may watch, when a video becomes playable |
| `services/storage/VideoStorageService.ts` | The only class that knows `@google-cloud/storage` exists — signs URLs, observes transcoder output |
| `services/storage/videoStoragePaths.ts` | The one place bucket layout is encoded, including picking the master playlist out of the output |
| `services/storage/PlaybackUrlProvider.ts` | Interface + storage-API signing implementation |
| `services/storage/CdnPlaybackProvider.ts` | Cloud CDN signing with `URLPrefix`, so `.ts` segments are covered too |
| `controllers/VideoAssetController.ts` | The seven HTTP endpoints |
| `container.ts`, `types.ts`, `index.ts` + barrels | DI wiring; auto-discovered by `loadModules` |

### Tests & tooling

| File | Covers |
|---|---|
| `tests/VideoAssetService.test.ts` | Authorization and the state machine (31 tests) |
| `tests/videoStoragePaths.test.ts` | Path and playlist logic, with the real pipeline output pinned verbatim |
| `tests/CdnPlaybackProvider.test.ts` | Signature verified against an independently recomputed HMAC |
| `tests/videoAssetTitle.test.ts` | Title defaulting |
| `../courses/tests/videoSource.test.ts` | The "absent `source` means YouTube" compatibility rule |
| `../../../scripts/verify-video-storage.cjs` | One-command diagnostic: credentials, bucket reach, signing, and what the transcoder produced |

---

## Frontend files

| File | Purpose |
|---|---|
| `components/video-players/hlsPlayerInstance.ts` | **The keystone** — an HLS backend exposing the YouTube player's interface, which is why proctoring and seek gating serve both |
| `components/HlsVideoPlayer.tsx` | Standalone player for previews (library, item editor) |
| `app/pages/teacher/course-videos.tsx` | The course video library page |
| `app/pages/teacher/components/VideoUploadDialog.tsx` | Upload modal — name, description, file, progress |
| `app/pages/teacher/components/VideoAssetPicker.tsx` | Searchable picker over the library |
| `hooks/media-hooks.ts` | React Query hooks, including the upload orchestration |
| `lib/api/media.ts` | API client, hand-rolled — the OpenAPI generator is a placeholder (see [Gotchas](#gotchas)) |
| `types/media.types.ts` | Shared types + `resolveVideoSource` |

### Files this feature modified

**Core behaviour**

- `shared/interfaces/models.ts` — `source` / `assetId` on video details, plus `resolveVideoSource`
- `courses/classes/validators/ItemValidators.ts` — conditional validation: URL for YouTube, assetId for uploads
- `config/storage.ts` — video buckets, TTLs, size cap, CDN config
- `components/video.tsx` — **the sensitive one.** Three surgical edits so it drives either backend
- `components/Item-container.tsx` — passes `source` / `assetId` through to one player
- `users/services/ProgressService.ts` — an unrelated empty-section `500` fix (see [Gotchas](#gotchas))

**Teacher flow**

- `Video-modal.tsx` — YouTube/upload toggle, picker, timestamps for uploads
- `teacher-course-page.tsx` — sends `source` / `assetId` on item create
- `course-page.tsx` — the *Course Videos* nav button
- `routes/router.tsx` — the new route

**Types & deps**

- `types/video.types.ts`, `types/item-container.types.ts` — new optional fields
- `frontend/package.json`, `pnpm-lock.yaml` — added `hls.js`
- `backend/.example.env` — documented every new variable

---

## One player, two backends

`components/video.tsx` (~2,300 lines) carries watch-time tracking, proctoring, anomaly
capture, gesture handling, seek gating, keyboard locks and the away/pause overlays. A
separate HLS player would have meant reimplementing all of it, and the two copies
would drift the first time either was fixed.

Measuring first showed only **~11 methods** in that file are actually YouTube-specific
(`playVideo`, `pauseVideo`, `seekTo`, `getCurrentTime`, `getDuration`, volume, playback
rate, quality, `setOption`). Everything else is player-agnostic logic that merely calls
them. So `hlsPlayerInstance.ts` implements that same interface over `<video>` +
`hls.js`, and the existing ~60 call sites needed no change.

**If you add a capability to the player, add it to the interface — not to one
backend.** That is what keeps uploaded and YouTube lessons from diverging.

---

## API

All under `/media/video-assets`, restricted to instructors on the course version.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/upload-url` | Reserve an asset, return a signed PUT URL |
| `POST` | `/:assetId/uploaded` | Report upload finished (verified server-side) |
| `GET` | `/:assetId` | Processing status |
| `GET` | `/:assetId/playback-url` | Authorised, time-boxed HLS URL |
| `GET` | `/` | Course video library (`search`, `readyOnly`) |
| `PATCH` | `/:assetId` | Rename, or record duration |
| `DELETE` | `/:assetId` | Remove from library (refused if a lesson uses it) |

Uploads are **MP4 only** and capped at **2 GB** by default. Both are deliberate: the
transcoding pipeline is owned outside this repo and has only been verified with MP4, so
accepting a container it cannot handle would leave an upload that never becomes
playable.

---

## Deployment

⚠️ **Two infrastructure items block production. Both are outside this repo.**

| Item | Why it blocks |
|---|---|
| HTTPS on the CDN load balancer | An `http://` media URL is blocked as mixed content on an HTTPS frontend, so uploaded lessons will not play in production |
| Remove public read from the processed bucket | The bucket answers unauthenticated list and read requests, so signed playback URLs protect nothing until it is closed |

Environment variables are documented in `backend/.example.env`.

> **Do not point `GCLOUD_PROJECT` at the video project.** The Firebase Admin SDK reads
> that same variable to decide which project to verify ID tokens against, so doing so
> makes every authenticated request fail with
> `Firebase ID token has incorrect "aud" (audience) claim`. The video buckets read
> `GOOGLE_VIDEO_PROJECT_ID` for exactly this reason.

The service account needs `objectCreator` (or `objectAdmin`) on the raw bucket and
`objectViewer` on the stream bucket, plus CORS on both — `PUT` from the frontend
origins on the raw bucket, `GET`/`HEAD` on the stream bucket, since the player fetches
playlists and segments from the browser.

Check a deployment with:

```bash
cd backend
node scripts/verify-video-storage.cjs            # credentials, buckets, signing
node scripts/verify-video-storage.cjs --upload x.mp4   # full pipeline, prints the output layout
```

---

## Gotchas

- **The bucket layout has changed three times.** It costs no migration because every
  lookup reads the `uploadObjectKey` stored on each asset rather than recomputing it,
  and `candidateStreamPrefixes` derives its fallbacks from that stored key. **Preserve
  that property** if the layout moves again.
- **`backend/scripts/generate-openapi.cjs` is a placeholder** emitting only a `/health`
  path. Running the documented `pnpm copy && pnpm gen-schema` would overwrite
  `frontend/src/types/schema.ts` and delete every generated type. This module's frontend
  client is hand-rolled for that reason.
- **`ProgressService` carries an unrelated fix** included here because it blocked
  testing: a section whose items are all hidden or soft-deleted left an empty array that
  `getNextItemInSequence` and `getPreviousItemInSequence` indexed directly, returning a
  `500` from `stopItem`. **This affected YouTube lessons too.**
- **`durationSeconds` only populates after a first preview.** The transcoder does not
  report duration and the upload credential cannot read the source file, so the browser
  supplies it.
- **Storage is never reclaimed.** Removing a video soft-deletes the record only; this
  service holds no delete permission on either bucket. A lifecycle policy is needed.
- **Uploads are a single PUT** — fine for a few hundred MB, fragile for a multi-GB
  lecture on an unreliable connection. Resumable uploads would fix it.
- **AI question generation does not work on uploaded video.** The genAI pipeline takes a
  public YouTube URL as its input; uploaded video has none. Deliberately out of scope.
