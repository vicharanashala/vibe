/**
 * Every file a proctoring check downloads, pinned to an exact version so an
 * update on the model host can't change what a working app loads. Sizes are
 * the uncompressed byte counts: CDNs may compress responses, and then their
 * Content-Length doesn't match the bytes fetch() delivers, so these give an
 * accurate total from the first byte. `assets.spec.ts` fails if a pinned
 * version drifts from the installed package.
 */

export const FACE_API_VERSION = '1.7.15';
export const TASKS_AUDIO_VERSION = '0.10.22-rc.20250304';
/** Loaded from the CDN only (not an npm dependency), inside the gesture worker. */
export const TASKS_VISION_VERSION = '0.10.3';
export const FACE_DETECTION_MODEL = 'https://tfhub.dev/mediapipe/tfjs-model/face_detection/full/1';

export interface ModelAsset {
  /** Stable key, also used to hand the bytes to the code that needs them. */
  id: string;
  url: string;
  /** Uncompressed size in bytes, when known. */
  size?: number;
}

/** A proctoring check that needs downloaded files. */
export type ModelCheck = 'faceCount' | 'faceRecognition' | 'gesture' | 'voice';

export const MODEL_CHECK_LABELS: Record<ModelCheck, string> = {
  faceCount: 'Face detection',
  faceRecognition: 'Face recognition',
  gesture: 'Hand gestures',
  voice: 'Voice detection',
};

const FACE_API = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FACE_API_VERSION}/model`;
const TASKS_AUDIO = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@${TASKS_AUDIO_VERSION}/wasm`;
const TASKS_VISION = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}`;

/** face-api nets, each a weights manifest plus its one weights file. */
export const FACE_API_NETS = [
  { net: 'tinyFaceDetector', file: 'tiny_face_detector_model', manifestSize: 3219, weightsSize: 193321 },
  { net: 'faceLandmark68Net', file: 'face_landmark_68_model', manifestSize: 8485, weightsSize: 356840 },
  { net: 'faceRecognitionNet', file: 'face_recognition_model', manifestSize: 19615, weightsSize: 6444032 },
] as const;

export function faceRecognitionAssets(): ModelAsset[] {
  return FACE_API_NETS.flatMap(({ file, manifestSize, weightsSize }) => [
    { id: `${file}-manifest`, url: `${FACE_API}/${file}-weights_manifest.json`, size: manifestSize },
    { id: `${file}-weights`, url: `${FACE_API}/${file}.bin`, size: weightsSize },
  ]);
}

export function faceCountAssets(): ModelAsset[] {
  return [
    { id: 'model', url: `${FACE_DETECTION_MODEL}/model.json?tfjs-format=file`, size: 196835 },
    { id: 'weights', url: `${FACE_DETECTION_MODEL}/group1-shard1of1.bin?tfjs-format=file`, size: 1026192 },
  ];
}

/** MediaPipe ships SIMD and non-SIMD builds of its runtime; older browsers need the latter. */
export function voiceAssets(simd: boolean): ModelAsset[] {
  const name = simd ? 'audio_wasm_internal' : 'audio_wasm_nosimd_internal';
  return [
    { id: 'wasm-loader', url: `${TASKS_AUDIO}/${name}.js`, size: simd ? 161733 : 161586 },
    { id: 'wasm-binary', url: `${TASKS_AUDIO}/${name}.wasm`, size: simd ? 6004523 : 5877856 },
    {
      id: 'model',
      url: 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite',
      size: 4126810,
    },
  ];
}

export function gestureAssets(simd: boolean): ModelAsset[] {
  const name = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
  return [
    // The package's static bundle, not jsDelivr's generated "+esm" build, whose bytes can change.
    { id: 'library', url: `${TASKS_VISION}/vision_bundle.mjs`, size: 881037 },
    { id: 'wasm-loader', url: `${TASKS_VISION}/wasm/${name}.js`, size: simd ? 205745 : 205752 },
    { id: 'wasm-binary', url: `${TASKS_VISION}/wasm/${name}.wasm`, size: simd ? 8689767 : 8554370 },
    {
      id: 'model',
      url: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
      size: 8373440,
    },
  ];
}

/** Hosts the checks download from, for diagnostics. Each probe is a small pinned file. */
export const MODEL_HOSTS = [
  { host: 'cdn.jsdelivr.net', probe: `${FACE_API}/tiny_face_detector_model-weights_manifest.json` },
  {
    host: 'storage.googleapis.com',
    probe: 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite',
    probeBytes: 65_536,
  },
  { host: 'tfhub.dev (Kaggle)', probe: `${FACE_DETECTION_MODEL}/model.json?tfjs-format=file` },
] as const;
