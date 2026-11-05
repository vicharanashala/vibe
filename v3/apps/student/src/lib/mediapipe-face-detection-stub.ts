/**
 * Stub for @mediapipe/face_detection's own ESM build, which isn't statically
 * analysable (an old Closure-compiler UMD bundle with no real named exports) and
 * fails to bundle under Vite's rolldown build. @tensorflow-models/face-detection
 * only touches the real `FaceDetection` class when configured with
 * `runtime: 'mediapipe'` — this app always uses `runtime: 'tfjs'`, so the import
 * is dead code on our path; this stub exists only to satisfy the static import.
 */
export class FaceDetection {
  constructor() {
    throw new Error('@mediapipe/face_detection is stubbed out — this app only uses runtime: "tfjs".');
  }
}
