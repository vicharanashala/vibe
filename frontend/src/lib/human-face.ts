import type Human from '@vladmandic/human';

// Lazy singleton Human instance for the two one-shot, main-thread
// registration flows (FaceRegistrationModal, AuthPage) -- the continuous
// in-course detection path runs its own separate Human instance inside
// humanFaceWorker.js, off the main thread, and doesn't use this module.
export const HUMAN_EMBEDDING_LENGTH = 1024;

const humanConfig = {
  modelBasePath: '/models/human/',
  debug: false,
  warmup: 'none' as const,
  cacheSensitivity: 0,
  face: {
    enabled: true,
    detector: { enabled: true, maxDetected: 1, rotation: false, skipFrames: 0, skipTime: 0 },
    mesh: { enabled: true },
    attention: { enabled: false },
    iris: { enabled: false },
    emotion: { enabled: false },
    description: { enabled: true, skipFrames: 0, skipTime: 0 },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
  gesture: { enabled: false },
};

let humanPromise: Promise<Human> | null = null;

// Dynamic import so @vladmandic/human (bundled with its own TFJS copy,
// multiple MB) lands in its own chunk instead of every page's main bundle --
// only the two one-shot registration flows that actually call getHuman()
// trigger loading it.
export function getHuman(): Promise<Human> {
  if (!humanPromise) {
    humanPromise = (async () => {
      const { default: HumanCtor } = await import('@vladmandic/human');
      const human = new HumanCtor(humanConfig);
      await human.load();
      return human;
    })();
  }
  return humanPromise;
}

export interface DetectedFaceResult {
  box: { x: number; y: number; width: number; height: number };
  embedding: number[];
}

export async function detectPrimaryFace(
  input: HTMLVideoElement | HTMLImageElement,
): Promise<DetectedFaceResult | null> {
  const human = await getHuman();
  const result = await human.detect(input);
  const face = result.face[0];
  if (!face?.embedding || face.embedding.length !== HUMAN_EMBEDDING_LENGTH) {
    return null;
  }
  const [x, y, width, height] = face.box;
  return { box: { x, y, width, height }, embedding: face.embedding };
}

export async function embeddingSimilarity(a: number[], b: number[]): Promise<number> {
  const human = await getHuman();
  return human.match.similarity(a, b);
}
