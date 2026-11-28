// HumanFaceWorker - proctoring face-count + face-recognition, in one pass (B1).
//
// Classic (non-module) worker, loaded via importScripts() - same reasoning as
// faceDetectorWorker.js (which this replaces): a classic worker can use
// importScripts(), a module worker can't support libraries that call it
// internally. @vladmandic/human publishes a "script" build (dist/human.js,
// a plain `var Human = ...` global) specifically for this - see
// setup-human-assets.mjs, which self-hosts it under /models/human/ instead of
// Human's default CDN, so proctoring doesn't depend on a third-party service
// being up during an exam.
//
// One human.detect() call per frame returns both the face-count signal
// (previously MediaPipe BlazeFace, a separate worker) and, when enabled, each
// detected face's embedding for recognition (previously @vladmandic/face-api,
// a second separate model running on the main thread) - the whole point of
// this migration: one model load, one inference pass, instead of two
// independent ML stacks running simultaneously for what is conceptually one
// "who/how many faces are in frame" job.
let human = null;
let recognitionEnabled = false;
let frameCounter = 0;
// CameraProcessor captures at 4fps (see floating-video.tsx's
// useCameraProcessor(4, true)); running the expensive mesh+description pass
// (FaceMesh landmarks + the 7MB FaceRes embedding model) on every single one
// of those frames was the dominant main-thread/GPU cost of the whole
// proctoring pipeline -- for no benefit, since FaceRecognitionComponent's
// consecutive match/mismatch counters only need a new embedding roughly as
// often as the original face-api.js-era component sampled one (every
// VERIFY_INTERVAL_MS=1000ms). 4 ticks at 4fps = ~1/sec, same cadence.
// detector stays fresh every frame: B2's face-count ring buffer needs
// genuinely independent raw samples to do its majority-vote smoothing.
const DESCRIPTION_EVERY_N_FRAMES = 4;

console.log("✅ Human Face Worker started");

self.onerror = (err) => {
  console.error("❌ Worker error:", err);
};

function buildConfig(backend) {
  return {
    backend,
    modelBasePath: "/models/human/",
    wasmPath: "/models/human/",
    debug: false,
    async: true,
    warmup: "none", // explicit warmup() call below, so MODEL_READY reflects real readiness
    cacheSensitivity: 0,
    face: {
      enabled: true,
      // skipFrames/skipTime: 0 on both - we call detect() once per camera
      // frame ourselves (no Human-managed video() loop), and the rest of the
      // app's own temporal smoothing (floating-video.tsx's face-count buffer,
      // FaceRecognitionComponent's consecutive match/mismatch counters)
      // assumes every call does fresh, independent work. Human's own
      // frame-skip caching (on by default, meant for its internal video()
      // loop) would otherwise silently reuse a stale detection/embedding
      // across several of our calls, undermining both.
      detector: { enabled: true, maxDetected: 5, rotation: false, return: false, skipFrames: 0, skipTime: 0 },
      // mesh/description start disabled -- detectFaces() below flips both on
      // together only for the 1-in-N throttled tick where a fresh embedding
      // is actually wanted, since mesh exists solely to feed description's
      // crop/alignment and is wasted work on every other frame.
      mesh: { enabled: false },
      attention: { enabled: false },
      iris: { enabled: false },
      emotion: { enabled: false },
      description: { enabled: false, skipFrames: 0, skipTime: 0 }, // embeddings, for recognition
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    segmentation: { enabled: false },
    gesture: { enabled: false },
  };
}

async function initializeModel(isTesting) {
  try {
    importScripts("/models/human/human.js");

    // Same "try GPU, fall back to CPU" shape as faceDetectorWorker.js, since
    // WebGL in a worker needs an OffscreenCanvas context that can fail in the
    // same environments the old code guarded against (e.g. E2E testing,
    // headless browsers).
    const backend = isTesting ? "cpu" : "webgl";

    async function createHuman(useBackend) {
      // dist/human.js's "script" build assigns an esbuild CJS-namespace
      // object to the global `Human` (confirmed by inspecting the deployed
      // file directly), not the class itself -- the real constructor is at
      // Human.Human (same object as Human.default).
      const HumanCtor = self.Human.Human || self.Human.default || self.Human;
      const instance = new HumanCtor(buildConfig(useBackend));
      await instance.load();
      await instance.warmup();
      return instance;
    }

    try {
      human = await createHuman(backend);
      console.log(`🎯 Active backend: ${backend}`);
    } catch (err) {
      if (backend === "webgl") {
        console.warn("⚠️ WebGL backend failed, falling back to CPU:", err);
        human = await createHuman("cpu");
        console.log("🐢 Active backend: CPU (fallback)");
      } else {
        throw err;
      }
    }

    self.postMessage({ type: "MODEL_READY", backend: human.tf?.getBackend?.() || "unknown" });
    console.log("✅ Human face model ready");
  } catch (err) {
    console.error("❌ Model init failed:", err);
    self.postMessage({
      type: "ERROR",
      message: `Model initialization failed: ${String(err)}`,
    });
  }
}

async function detectFaces(imageBitmap) {
  if (!human) {
    self.postMessage({ type: "ERROR", message: "Model not initialized" });
    return;
  }

  try {
    frameCounter++;
    const wantDescriptionThisFrame =
      recognitionEnabled && frameCounter % DESCRIPTION_EVERY_N_FRAMES === 0;
    human.config.face.mesh.enabled = wantDescriptionThisFrame;
    human.config.face.description.enabled = wantDescriptionThisFrame;
    const result = await human.detect(imageBitmap);

    // Reshape to the same { box, keypoints, score } shape the rest of the app
    // already expects from the previous MediaPipe BlazeFace worker (box as
    // xMin/yMin/width/height/xMax/yMax, not Human's own [x,y,width,height]
    // array), so floating-video.tsx/FaceDetectors.tsx need no further changes
    // beyond the embedding field this adds.
    const faces = result.face.map((face) => {
      const [x, y, width, height] = face.box;
      return {
        box: { xMin: x, yMin: y, width, height, xMax: x + width, yMax: y + height },
        keypoints: [], // mesh/attention keypoints not needed by any current consumer
        score: face.score,
        embedding: wantDescriptionThisFrame ? (face.embedding ?? null) : null,
      };
    });

    self.postMessage({
      type: "DETECTION_RESULT",
      faces,
    });
  } catch (err) {
    console.error("❌ Face detection failed:", err);
    self.postMessage({
      type: "ERROR",
      message: `Detection failed: ${String(err)}`,
    });
  } finally {
    imageBitmap.close?.();
  }
}

self.onmessage = async (event) => {
  const { type, image, isTesting, enabled } = event.data;

  if (type === "INIT") {
    await initializeModel(!!isTesting);
  }

  if (type === "SET_RECOGNITION_ENABLED") {
    recognitionEnabled = !!enabled;
  }

  if (type === "DETECT_FACES" && image) {
    await detectFaces(image);
  }
};
