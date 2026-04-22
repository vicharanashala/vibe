import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useReportAnomalyImage } from '@/hooks/hooks';
import { useCourseStore } from '@/store/course-store';
import type {
  FaceRecognition,
  FaceRecognitionComponentProps,
  FaceRecognitionDebugInfo,
  FaceBehaviorStatus,
} from '@/types/ai.types';

const EMBEDDING_LENGTH = 128;
const VERIFY_INTERVAL_MS = 400;
const MATCH_THRESHOLD = 0.6;
const REQUIRED_MATCHES = 3;
const REQUIRED_MISMATCHES = 2;
const FACE_MISS_GRACE_MS = 1500;

type FaceReferenceResponse = {
  label: string;
  faceEmbedding?: number[] | null;
};

const normalizeEmbedding = (embedding: unknown): number[] | null => {
  if (!embedding) {
    return null;
  }

  if (Array.isArray(embedding)) {
    return embedding.map(Number);
  }

  if (ArrayBuffer.isView(embedding)) {
    return Array.from(embedding, Number);
  }

  if (typeof embedding === 'object') {
    const values = Object.keys(embedding as Record<string, unknown>)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => Number((embedding as Record<string, unknown>)[key]));

    return values.length ? values : null;
  }

  return null;
};

const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const getTiltAngleDegrees = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);

const getAverageY = (points: faceapi.Point[]) => {
  if (!points.length) return 0;
  return points.reduce((sum, point) => sum + point.y, 0) / points.length;
};

const getNormalizedDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const getAverageNormalizedPoint = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  const totals = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: totals.x / points.length,
    y: totals.y / points.length,
  };
};

const getLargestDetectedFace = <T extends { detection: { box: { width: number; height: number } } }>(detections: T[]) =>
  detections.reduce<T | null>((largest, current) => {
    const currentArea = current.detection.box.width * current.detection.box.height;
    const largestArea = largest ? largest.detection.box.width * largest.detection.box.height : -1;
    return currentArea > largestArea ? current : largest;
  }, null);

const createDetectorOptions = () =>
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 512,
    scoreThreshold: 0.35,
  });

const getEyeAspectRatio = (eye: faceapi.Point[]) => {
  if (eye.length < 6) return 1;
  const vertical1 = getDistance(eye[1], eye[5]);
  const vertical2 = getDistance(eye[2], eye[4]);
  const horizontal = getDistance(eye[0], eye[3]);
  return (vertical1 + vertical2) / (2 * Math.max(horizontal, 1));
};

const getMouthAspectRatio = (mouth: faceapi.Point[]) => {
  if (mouth.length < 20) return 0;
  const topLip = mouth[13];
  const bottomLip = mouth[19];
  const leftCorner = mouth[0];
  const rightCorner = mouth[6];
  const vertical = getDistance(topLip, bottomLip);
  const horizontal = getDistance(leftCorner, rightCorner);
  return horizontal > 0 ? vertical / horizontal : 0;
};

const getHeadDownScore = (landmarks: faceapi.FaceLandmarks68): number => {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();

  if (!leftEye.length || !rightEye.length || !nose.length) return 0;

  const eyeCenterY = (leftEye[1].y + rightEye[1].y) / 2;
  const noseTip = nose[Math.floor(nose.length / 2)];
  const verticalDelta = noseTip.y - eyeCenterY;
  const faceHeight = Math.abs(landmarks.getJawOutline()[8].y - eyeCenterY) || 1;

  return verticalDelta / faceHeight;
};

type DemoLandmark = { x: number; y: number; z?: number; visibility?: number };
type DemoLandmarkList = DemoLandmark[];

const getMeshEyeAspectRatio = (landmarks: DemoLandmarkList, left: boolean) => {
  const indices = left
    ? { outer: 33, inner: 133, upper: 159, lower: 145 }
    : { outer: 362, inner: 263, upper: 386, lower: 374 };

  const outer = landmarks[indices.outer];
  const inner = landmarks[indices.inner];
  const upper = landmarks[indices.upper];
  const lower = landmarks[indices.lower];

  if (!outer || !inner || !upper || !lower) {
    return 0;
  }

  return getNormalizedDistance(upper, lower) / Math.max(getNormalizedDistance(outer, inner), 1e-4);
};

const getMeshMetrics = (landmarks: DemoLandmarkList) => {
  const mouthTop = landmarks[13];
  const mouthBottom = landmarks[14];
  const mouthLeft = landmarks[78];
  const mouthRight = landmarks[308];
  const noseTip = landmarks[1];
  const chin = landmarks[152];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  // Forehead approximation: midpoint between the two brow landmarks
  const leftBrow = landmarks[10];
  const rightBrow = landmarks[338];

  if (!mouthTop || !mouthBottom || !mouthLeft || !mouthRight || !noseTip || !chin || !leftEye || !rightEye) {
    return null;
  }

  const eyeAspectRatio =
    (getMeshEyeAspectRatio(landmarks, true) + getMeshEyeAspectRatio(landmarks, false)) / 2;
  const mouthAspectRatio =
    getNormalizedDistance(mouthTop, mouthBottom) /
    Math.max(getNormalizedDistance(mouthLeft, mouthRight), 1e-4);
  const eyeCenter = getAverageNormalizedPoint([leftEye, rightEye]);
  const eyeToChin = Math.max(chin.y - eyeCenter.y, 1e-4);

  // faceHeight: distance from top of face (brow) to chin in normalized frame coords.
  // Shrinks when the person moves away from the camera (slouches back).
  const browCenter = leftBrow && rightBrow
    ? getAverageNormalizedPoint([leftBrow, rightBrow])
    : eyeCenter;
  const faceHeight = chin.y - browCenter.y;

  return {
    eyeAspectRatio,
    mouthAspectRatio,
    // Ratio of nose-to-eye distance vs eye-to-chin — increases when head tilts down
    headDownScore: (noseTip.y - eyeCenter.y) / eyeToChin,
    postureDropScore: eyeToChin / Math.max(faceHeight, 1e-4),
    eyeTiltAngle: getTiltAngleDegrees(leftEye, rightEye),
    // Absolute Y position of eye center in the video frame (0=top, 1=bottom).
    // Increases when the person slouches and their head drops in the frame.
    eyeCenterY: eyeCenter.y,
    // Absolute Y of face center (eye midpoint to chin midpoint)
    faceCenterYRatio: (eyeCenter.y + chin.y) / 2,
    // Face height in normalized frame coords — shrinks when person moves back
    faceHeight,
  };
};

const FaceRecognitionComponent: React.FC<FaceRecognitionComponentProps> = ({
  faces,
  videoRef,
  onRecognitionResult,
  onDebugInfoUpdate,
  onMismatchChange,
  onBehaviorResult,
  demoMode = false,
}) => {
  const [isReady, setIsReady] = useState(false);

  const reportImage = useReportAnomalyImage();
  const courseStore = useCourseStore();
  const referenceEmbeddingRef = useRef<number[] | null>(null);
  const referenceLabelRef = useRef('registered-user');
  const matchCountRef = useRef(0);
  const mismatchCountRef = useRef(0);
  const mismatchReportedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const baselineRef = useRef<{
    eyeAspectRatio: number | null;
    mouthAspectRatio: number | null;
    headDownScore: number | null;
    postureDropScore: number | null;
    eyeTiltAngle: number | null;
    faceCenterYRatio: number | null;
    // Positional baseline — locked after warm-up, not drifted
    eyeCenterY: number | null;
    faceHeight: number | null;
    samples: number;
  }>({
    eyeAspectRatio: null,
    mouthAspectRatio: null,
    headDownScore: null,
    postureDropScore: null,
    eyeTiltAngle: null,
    faceCenterYRatio: null,
    eyeCenterY: null,
    faceHeight: null,
    samples: 0,
  });
  const lastBehaviorRef = useRef<FaceBehaviorStatus | null>(null);
  const lastFaceSeenAtRef = useRef<number>(0);
  const demoFaceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const behaviorStabilityRef = useRef<{
    lookingDown: { active: boolean; positiveFrames: number; negativeFrames: number };
    slouching: { active: boolean; positiveFrames: number; negativeFrames: number };
    sleepy: { active: boolean; positiveFrames: number; negativeFrames: number };
    yawning: { active: boolean; positiveFrames: number; negativeFrames: number };
  }>({
    lookingDown: { active: false, positiveFrames: 0, negativeFrames: 0 },
    slouching: { active: false, positiveFrames: 0, negativeFrames: 0 },
    sleepy: { active: false, positiveFrames: 0, negativeFrames: 0 },
    yawning: { active: false, positiveFrames: 0, negativeFrames: 0 },
  });

  const publishNeutralBehavior = useCallback(() => {
    onBehaviorResult?.({
      isSlouching: false,
      isLookingDown: false,
      isSleepy: false,
      isYawning: false,
      isFatigued: false,
      fatigueScore: 0,
      eyeAspectRatio: 0,
      mouthAspectRatio: 0,
      headDownScore: 0,
      faceHeightShrink: 0,
      eyeTiltAngle: 0,
      eyeCenterYDelta: 0,
    });
  }, [onBehaviorResult]);

  const getStableState = useCallback((
    key: keyof typeof behaviorStabilityRef.current,
    detected: boolean,
    activateFrames: number,
    releaseFrames: number,
  ) => {
    const state = behaviorStabilityRef.current[key];

    if (detected) {
      state.positiveFrames += 1;
      state.negativeFrames = 0;

      if (!state.active && state.positiveFrames >= activateFrames) {
        state.active = true;
      }
    } else {
      state.negativeFrames += 1;
      state.positiveFrames = 0;

      if (state.active && state.negativeFrames >= releaseFrames) {
        state.active = false;
      }
    }

    return state.active;
  }, []);

  const updateBaseline = useCallback((
    eyeAspectRatio: number,
    mouthAspectRatio: number,
    headDownScore: number,
    postureDropScore: number,
    eyeTiltAngle: number,
    faceCenterYRatio: number,
    eyeCenterY?: number,
    faceHeight?: number,
  ) => {
    const baseline = baselineRef.current;
    const alpha = baseline.samples < 8 ? 0.3 : 0.08;

    baseline.eyeAspectRatio =
      baseline.eyeAspectRatio === null
        ? eyeAspectRatio
        : baseline.eyeAspectRatio * (1 - alpha) + eyeAspectRatio * alpha;
    baseline.mouthAspectRatio =
      baseline.mouthAspectRatio === null
        ? mouthAspectRatio
        : baseline.mouthAspectRatio * (1 - alpha) + mouthAspectRatio * alpha;
    baseline.headDownScore =
      baseline.headDownScore === null
        ? headDownScore
        : baseline.headDownScore * (1 - alpha) + headDownScore * alpha;
    baseline.postureDropScore =
      baseline.postureDropScore === null
        ? postureDropScore
        : baseline.postureDropScore * (1 - alpha) + postureDropScore * alpha;
    baseline.eyeTiltAngle =
      baseline.eyeTiltAngle === null
        ? eyeTiltAngle
        : baseline.eyeTiltAngle * (1 - alpha) + eyeTiltAngle * alpha;
    baseline.faceCenterYRatio =
      baseline.faceCenterYRatio === null
        ? faceCenterYRatio
        : baseline.faceCenterYRatio * (1 - alpha) + faceCenterYRatio * alpha;

    // Positional signals: only update during warm-up (first 10 samples), then lock.
    // This prevents the baseline from chasing a slouch.
    if (baseline.samples < 10) {
      if (eyeCenterY !== undefined) {
        baseline.eyeCenterY =
          baseline.eyeCenterY === null
            ? eyeCenterY
            : baseline.eyeCenterY * (1 - alpha) + eyeCenterY * alpha;
      }
      if (faceHeight !== undefined) {
        baseline.faceHeight =
          baseline.faceHeight === null
            ? faceHeight
            : baseline.faceHeight * (1 - alpha) + faceHeight * alpha;
      }
    }

    baseline.samples += 1;
  }, []);

  const updateDebugInfo = useCallback((updates: Partial<FaceRecognitionDebugInfo>) => {
    const next: FaceRecognitionDebugInfo = {
      knownFacesCount: 0,
      knownFaceLabels: [],
      detectedPhotoFaces: 0,
      currentFrameFaces: 0,
      recognizedFaces: 0,
      trackedFaces: 0,
      reusedTracks: 0,
      newRecognitions: 0,
      lastUpdateTime: Date.now(),
      backendStatus: 'loading',
      ...updates,
     
    };

    onDebugInfoUpdate?.(next);
  }, [onDebugInfoUpdate]);

  const fetchFaceReference = useCallback(async (): Promise<FaceReferenceResponse> => {
    const authToken = localStorage.getItem('firebase-auth-token');
    if (!authToken) {
      throw new Error('No auth token available for face reference lookup.');
    }

    const response = await fetch(`${import.meta.env.VITE_BASE_URL}/users/me/face-reference`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch face reference: ${response.status}`);
    }

    return response.json();
  }, []);

  const createMismatchSnapshot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise<File | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }

        resolve(new File([blob], `face-mismatch-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    });
  }, [videoRef]);

  const reportMismatch = useCallback(async () => {
    const course = courseStore.currentCourse;
    if (!course?.courseId || !course?.versionId || !course?.itemId) {
      return;
    }

    const file = await createMismatchSnapshot();
    if (!file) {
      return;
    }

    await reportImage.mutateAsync({
      body: {
        type: 'FACE_RECOGNITION' as any,
        courseId: course.courseId,
        versionId: course.versionId,
        itemId: course.itemId,
      },
      file,
    });
  }, [courseStore.currentCourse, createMismatchSnapshot, reportImage]);

  const resetVerificationState = useCallback(() => {
    matchCountRef.current = 0;
    mismatchCountRef.current = 0;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        updateDebugInfo({ backendStatus: 'loading', errorMessage: undefined });

        if (demoMode) {
          if (!isMounted) {
            return;
          }

          setIsReady(true);
          updateDebugInfo({
            knownFacesCount: 0,
            knownFaceLabels: [],
            detectedPhotoFaces: 0,
            backendStatus: 'success',
            errorMessage: undefined,
          });
          return;
        }

        const modelPaths = ['/models', 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'];
        let loaded = false;

        for (const modelPath of modelPaths) {
          try {
            await Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
              faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
              faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
            ]);
            loaded = true;
            break;
          } catch (error) {
            console.warn('[FaceRecognitionDebug] model path failed', { modelPath, error });
          }
        }

        if (!loaded) {
          throw new Error('Failed to load face recognition models.');
        }

        const reference = await fetchFaceReference();
        const normalizedEmbedding = normalizeEmbedding(reference.faceEmbedding);

        if (!normalizedEmbedding || normalizedEmbedding.length !== EMBEDDING_LENGTH) {
          throw new Error('Stored face embedding is invalid. Please register again.');
        }

        referenceEmbeddingRef.current = normalizedEmbedding;
        referenceLabelRef.current = reference.label || 'registered-user';

        if (!isMounted) {
          return;
        }

        setIsReady(true);
        updateDebugInfo({
          knownFacesCount: 1,
          knownFaceLabels: [referenceLabelRef.current],
          detectedPhotoFaces: 1,
          backendStatus: 'success',
        });
      } catch (error) {
        console.error('[FaceRecognitionComponent] Initialization failed:', error);
        if (!isMounted) {
          return;
        }

        updateDebugInfo({
          backendStatus: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [demoMode, fetchFaceReference, updateDebugInfo]);

  useEffect(() => {
    if (!demoMode) {
      return;
    }

    let disposed = false;

    void (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );
        if (disposed) {
          return;
        }

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (disposed) {
          void landmarker.close();
          return;
        }

        demoFaceLandmarkerRef.current = landmarker;
      } catch (error) {
        console.error('[FaceRecognitionComponent] Demo FaceLandmarker initialization failed:', error);
      }
    })();

    return () => {
      disposed = true;
      demoFaceLandmarkerRef.current?.close();
      demoFaceLandmarkerRef.current = null;
    };
  }, [demoMode]);

  const processRecognition = useCallback(async () => {
    const referenceEmbedding = referenceEmbeddingRef.current;
    const video = videoRef.current;

    if (!isReady || !video || isProcessingRef.current) {
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    isProcessingRef.current = true;
    const startTime = performance.now();

    try {
      if (demoMode) {
        const landmarker = demoFaceLandmarkerRef.current;
        if (!landmarker) {
          publishNeutralBehavior();
          updateDebugInfo({
            currentFrameFaces: faces.length,
            recognizedFaces: 0,
            newRecognitions: 0,
            processingTime: performance.now() - startTime,
            errorMessage: 'Face landmarker is still initializing.',
            backendStatus: 'success',
          });
          return;
        }

        const now = Date.now();
        const result = landmarker.detectForVideo(video, now);
        const landmarks = result.faceLandmarks?.[0] ?? null;

        if (!landmarks) {
          publishNeutralBehavior();
          onRecognitionResult?.([]);
          updateDebugInfo({
            currentFrameFaces: faces.length,
            recognizedFaces: 0,
            newRecognitions: 0,
            processingTime: performance.now() - startTime,
            errorMessage: 'No face landmarks detected in sampled frame.',
            backendStatus: 'success',
          });
          return;
        }

        const metrics = getMeshMetrics(landmarks);
        if (!metrics) {
          publishNeutralBehavior();
          return;
        }

        lastFaceSeenAtRef.current = now;

        const {
          eyeAspectRatio,
          mouthAspectRatio,
          headDownScore,
          postureDropScore,
          eyeTiltAngle,
          faceCenterYRatio,
          eyeCenterY,
          faceHeight,
        } = metrics;

        const baseline = baselineRef.current;
        const hasBaseline = baseline.samples >= 6 &&
          baseline.eyeAspectRatio !== null &&
          baseline.mouthAspectRatio !== null &&
          baseline.headDownScore !== null &&
          baseline.postureDropScore !== null &&
          baseline.eyeTiltAngle !== null &&
          baseline.faceCenterYRatio !== null;

        // Always seed the baseline during the warm-up period.
        if (!hasBaseline) {
          updateBaseline(
            eyeAspectRatio,
            mouthAspectRatio,
            headDownScore,
            postureDropScore,
            eyeTiltAngle,
            faceCenterYRatio,
            eyeCenterY,
            faceHeight
          );
        }

        const eyeBaseline = baseline.eyeAspectRatio ?? eyeAspectRatio;
        const mouthBaseline = baseline.mouthAspectRatio ?? Math.max(mouthAspectRatio, 0.05);
        const headBaseline = baseline.headDownScore ?? headDownScore;
        const postureBaseline = baseline.postureDropScore ?? postureDropScore;
        const tiltBaseline = baseline.eyeTiltAngle ?? eyeTiltAngle;
        const faceCenterBaseline = baseline.faceCenterYRatio ?? faceCenterYRatio;
        const headDownDelta = headDownScore - headBaseline;
        const postureDropDelta = postureDropScore - postureBaseline;
        const eyeTiltDelta = Math.abs(eyeTiltAngle - tiltBaseline);
        const faceCenterDelta = faceCenterYRatio - faceCenterBaseline;

        // Positional baselines — locked after warm-up so slouch can't be absorbed
        const eyeCenterYBaseline = baseline.eyeCenterY ?? eyeCenterY;
        const faceHeightBaseline = baseline.faceHeight ?? faceHeight;

        // How far the eye center has dropped in the frame (positive = face moved down = slouch)
        const eyeCenterYDelta = eyeCenterY - eyeCenterYBaseline;
        // How much the face has shrunk (positive = face smaller = person moved back = slouch)
        const faceHeightShrink = faceHeightBaseline > 0
          ? (faceHeightBaseline - faceHeight) / faceHeightBaseline
          : 0;

        // MediaPipe landmarks are normalized (0–1).
        // headDownScore = (noseTip.y - eyeCenter.y) / eyeToChin — typically ~0.35–0.45 upright,
        // rises to ~0.55+ when looking down.
        // eyeCenterY: absolute Y of eye center in frame — increases when face drops (slouch).
        // faceHeightShrink: face appears smaller when person moves back (slouch).
        const rawLookingDown =
          headDownScore > Math.max(headBaseline + 0.03, 0.44) ||
          headDownDelta > 0.04 ||
          (headDownDelta > 0.025 && eyeCenterYDelta > 0.01);
        // Slouching: face drops in frame OR face shrinks (person moves back/hunches)
        // OR head tilts significantly forward. Use OR of multiple weak signals.
        const rawSlouching =
          eyeCenterYDelta > 0.015 ||
          faceHeightShrink > 0.03 ||
          postureDropDelta > 0.02 ||
          eyeTiltDelta > 8 ||
          (headDownDelta > 0.025 && eyeCenterYDelta > 0.01) ||
          faceCenterDelta > 0.02;
        const rawSleepy = eyeAspectRatio < Math.max(eyeBaseline * 0.78, 0.2);
        const rawYawning = mouthAspectRatio > Math.max(mouthBaseline * 1.45, 0.12);

        const isLookingDown = getStableState('lookingDown', rawLookingDown, 2, 2);
        const isSlouching = getStableState('slouching', rawSlouching, 2, 2);
        const isSleepy = getStableState('sleepy', rawSleepy, 3, 3);
        const isYawning = getStableState('yawning', rawYawning, 2, 2);

        // Update baseline when neutral. Also allow very slow drift correction even during
        // anomalies so the baseline never gets permanently stuck.
        if (!rawLookingDown && !rawSleepy && !rawYawning && !rawSlouching) {
          updateBaseline(
            eyeAspectRatio,
            mouthAspectRatio,
            headDownScore,
            postureDropScore,
            eyeTiltAngle,
            faceCenterYRatio,
            eyeCenterY,
            faceHeight
          );
        } else if (hasBaseline) {
          // Slow drift correction (alpha = 0.01) for expression signals only.
          // Positional signals (eyeCenterY, faceHeight) are NOT drifted — they stay locked.
          const b = baselineRef.current;
          const slowAlpha = 0.01;
          b.eyeAspectRatio = b.eyeAspectRatio! * (1 - slowAlpha) + eyeAspectRatio * slowAlpha;
          b.mouthAspectRatio = b.mouthAspectRatio! * (1 - slowAlpha) + mouthAspectRatio * slowAlpha;
          b.headDownScore = b.headDownScore! * (1 - slowAlpha) + headDownScore * slowAlpha;
          b.postureDropScore = b.postureDropScore! * (1 - slowAlpha) + postureDropScore * slowAlpha;
          b.eyeTiltAngle = b.eyeTiltAngle! * (1 - slowAlpha) + eyeTiltAngle * slowAlpha;
          b.faceCenterYRatio = b.faceCenterYRatio! * (1 - slowAlpha) + faceCenterYRatio * slowAlpha;
        }

        const fatigueScore = Number(
          (
            (isSleepy ? 0.5 : 0) +
            (isYawning ? 0.25 : 0) +
            (isLookingDown ? 0.2 : 0) +
            (isSlouching ? 0.25 : 0)
          ).toFixed(2)
        );
        const behavior: FaceBehaviorStatus = {
          isSlouching,
          isLookingDown,
          isSleepy,
          isYawning,
          isFatigued: fatigueScore >= 0.4,
          fatigueScore,
          eyeAspectRatio,
          mouthAspectRatio,
          headDownScore,
          faceHeightShrink,
          eyeTiltAngle,
          eyeCenterYDelta,
        };

        console.debug('[BehaviorDemo]', {
          eyeAspectRatio: eyeAspectRatio.toFixed(3),
          eyeBaseline: eyeBaseline.toFixed(3),
          mouthAspectRatio: mouthAspectRatio.toFixed(3),
          mouthBaseline: mouthBaseline.toFixed(3),
          headDownScore: headDownScore.toFixed(3),
          headBaseline: headBaseline.toFixed(3),
          postureDropScore: postureDropScore.toFixed(3),
          postureBaseline: postureBaseline.toFixed(3),
          postureDropDelta: postureDropDelta.toFixed(3),
          eyeTiltAngle: eyeTiltAngle.toFixed(2),
          tiltBaseline: tiltBaseline.toFixed(2),
          eyeTiltDelta: eyeTiltDelta.toFixed(2),
          eyeCenterY: eyeCenterY.toFixed(3),
          eyeCenterYBaseline: eyeCenterYBaseline.toFixed(3),
          eyeCenterYDelta: eyeCenterYDelta.toFixed(3),
          faceHeight: faceHeight.toFixed(3),
          faceHeightBaseline: faceHeightBaseline.toFixed(3),
          faceHeightShrink: faceHeightShrink.toFixed(3),
          faceCenterDelta: faceCenterDelta.toFixed(3),
          rawLookingDown,
          rawSlouching,
          rawSleepy,
          rawYawning,
          isLookingDown,
          isSlouching,
          isSleepy,
          isYawning,
        });

        lastBehaviorRef.current = behavior;
        onBehaviorResult?.(behavior);
        onRecognitionResult?.([
          {
            box: {
              x: 0,
              y: 0,
              width: video.videoWidth || 1,
              height: video.videoHeight || 1,
            },
            label: 'Live face',
            distance: 0,
            isMatch: true,
          },
        ]);
        onMismatchChange?.(false);
        updateDebugInfo({
          currentFrameFaces: Math.max(faces.length, 1),
          recognizedFaces: 1,
          newRecognitions: 1,
          processingTime: performance.now() - startTime,
          backendStatus: 'success',
          errorMessage: undefined,
        });
        return;
      }

      // Keep verification focused on the single student face, just like the simpler working sample.
      const detections = await faceapi
        .detectAllFaces(video, createDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();
      const detection = getLargestDetectedFace(detections);
      const now = Date.now();

      if (!detection?.descriptor) {
        const hasRecentFace = now - lastFaceSeenAtRef.current < FACE_MISS_GRACE_MS;

        if (hasRecentFace && lastBehaviorRef.current) {
          onBehaviorResult?.(lastBehaviorRef.current);
        } else {
          publishNeutralBehavior();
          onRecognitionResult?.([]);
        }

        updateDebugInfo({
          currentFrameFaces: faces.length,
          recognizedFaces: 0,
          newRecognitions: 0,
          processingTime: performance.now() - startTime,
          errorMessage: 'No face detected in sampled frame.',
          backendStatus: 'success',
        });
        return;
      }

      lastFaceSeenAtRef.current = now;

      const landmarks = detection.landmarks as faceapi.FaceLandmarks68;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const mouth = landmarks.getMouth();

      const leftEAR = getEyeAspectRatio(leftEye);
      const rightEAR = getEyeAspectRatio(rightEye);
      const eyeAspectRatio = (leftEAR + rightEAR) / 2;
      const mouthAspectRatio = getMouthAspectRatio(mouth);
      const headDownScore = getHeadDownScore(landmarks);
      const eyeCenterY = (getAverageY(leftEye) + getAverageY(rightEye)) / 2;
      const leftEyeCenter = {
        x: leftEye.reduce((sum, point) => sum + point.x, 0) / Math.max(leftEye.length, 1),
        y: leftEye.reduce((sum, point) => sum + point.y, 0) / Math.max(leftEye.length, 1),
      };
      const rightEyeCenter = {
        x: rightEye.reduce((sum, point) => sum + point.x, 0) / Math.max(rightEye.length, 1),
        y: rightEye.reduce((sum, point) => sum + point.y, 0) / Math.max(rightEye.length, 1),
      };
      const eyeTiltAngle = getTiltAngleDegrees(leftEyeCenter, rightEyeCenter);
      const jaw = landmarks.getJawOutline();
      const chinY = jaw.length > 8 ? jaw[8].y : eyeCenterY;
      const postureDropScore = Math.max(chinY - eyeCenterY, 0) / Math.max(detection.detection.box.height, 1);
      const faceCenterYRatio =
        (detection.detection.box.y + detection.detection.box.height / 2) / Math.max(video.videoHeight, 1);

      const baseline = baselineRef.current;
      const hasBaseline = baseline.samples >= 4 &&
        baseline.eyeAspectRatio !== null &&
        baseline.mouthAspectRatio !== null &&
        baseline.headDownScore !== null &&
        baseline.postureDropScore !== null &&
        baseline.eyeTiltAngle !== null &&
        baseline.faceCenterYRatio !== null;

      // Keep adapting the neutral baseline when the face looks normal.
      if (!hasBaseline) {
        updateBaseline(eyeAspectRatio, mouthAspectRatio, headDownScore, postureDropScore, eyeTiltAngle, faceCenterYRatio);
      }

      const eyeBaseline = baseline.eyeAspectRatio ?? eyeAspectRatio;
      const mouthBaseline = baseline.mouthAspectRatio ?? Math.max(mouthAspectRatio, 0.12);
      const headBaseline = baseline.headDownScore ?? headDownScore;
      const postureBaseline = baseline.postureDropScore ?? postureDropScore;
      const tiltBaseline = baseline.eyeTiltAngle ?? eyeTiltAngle;
      const faceCenterBaseline = baseline.faceCenterYRatio ?? faceCenterYRatio;
      const headDownDelta = headDownScore - headBaseline;
      const postureDropDelta = postureDropScore - postureBaseline;
      const eyeTiltDelta = Math.abs(eyeTiltAngle - tiltBaseline);
      const faceCenterDelta = faceCenterYRatio - faceCenterBaseline;

      const rawLookingDown =
        headDownScore > Math.max(headBaseline + 0.018, 0.105) ||
        headDownDelta > 0.012 ||
        (headDownDelta > 0.01 && postureDropScore > 0.32);
      const rawSlouching =
        (headDownScore > Math.max(headBaseline + 0.022, 0.14) &&
          (postureDropDelta > 0.02 || postureDropScore > 0.32 || faceCenterDelta > 0.015)) ||
        eyeTiltDelta > 8 ||
        faceCenterYRatio > Math.max(faceCenterBaseline + 0.03, 0.56);
      const rawSleepy = eyeAspectRatio < Math.max(eyeBaseline * 0.82, 0.19);
      const rawYawning = mouthAspectRatio > Math.max(mouthBaseline * 1.35, 0.09);

      const isLookingDown = getStableState('lookingDown', rawLookingDown, 2, 2);
      const isSlouching = getStableState('slouching', rawSlouching, 2, 2);
      const isSleepy = getStableState('sleepy', rawSleepy, 3, 3);
      const isYawning = getStableState('yawning', rawYawning, 2, 2);

      if (!rawLookingDown && !rawSleepy && !rawYawning && !rawSlouching) {
        updateBaseline(eyeAspectRatio, mouthAspectRatio, headDownScore, postureDropScore, eyeTiltAngle, faceCenterYRatio);
      }

      const fatigueScore = Number(
        (
          (isSleepy ? 0.5 : 0) +
          (isYawning ? 0.25 : 0) +
          (isLookingDown ? 0.2 : 0) +
          (isSlouching ? 0.25 : 0)
        ).toFixed(2)
      );
      const isFatigued = fatigueScore >= 0.4;

      const behavior: FaceBehaviorStatus = {
        isSlouching,
        isLookingDown,
        isSleepy,
        isYawning,
        isFatigued,
        fatigueScore,
        eyeAspectRatio,
        mouthAspectRatio,
        headDownScore,
        faceHeightShrink: 0,
        eyeTiltAngle,
        eyeCenterYDelta: 0,
      };
      lastBehaviorRef.current = behavior;

      onBehaviorResult?.(behavior);

      if (!referenceEmbedding || demoMode) {
        onRecognitionResult?.([
          {
            box: detection.detection.box,
            label: 'Live face',
            distance: 0,
            isMatch: true,
          },
        ]);
        onMismatchChange?.(false);
        updateDebugInfo({
          currentFrameFaces: Math.max(detections.length, faces.length, 1),
          recognizedFaces: 1,
          newRecognitions: 1,
          processingTime: performance.now() - startTime,
          backendStatus: 'success',
          errorMessage: undefined,
        });
        return;
      }

      const descriptor =
        'descriptor' in detection && detection.descriptor
          ? detection.descriptor
          : null;
      const liveEmbedding = descriptor ? normalizeEmbedding(Array.from(descriptor)) : null;
      if (!liveEmbedding || liveEmbedding.length !== EMBEDDING_LENGTH) {
        updateDebugInfo({
          currentFrameFaces: 1,
          recognizedFaces: 0,
          newRecognitions: 0,
          processingTime: performance.now() - startTime,
          errorMessage: 'Live face data is invalid. Try again.',
          backendStatus: 'success',
        });
        return;
      }

      const distance = faceapi.euclideanDistance(referenceEmbedding, liveEmbedding);
      const rawMatch = distance < MATCH_THRESHOLD;

      let recognition: FaceRecognition = {
        box: detection.detection.box,
        label: 'unknown',
        distance,
        isMatch: false,
      };
      let hasConfirmedMismatch = mismatchReportedRef.current;

      if (rawMatch) {
        matchCountRef.current += 1;
        mismatchCountRef.current = 0;

        if (matchCountRef.current >= REQUIRED_MATCHES) {
          recognition = {
            box: detection.detection.box,
            label: referenceLabelRef.current,
            distance,
            isMatch: true,
          };
          hasConfirmedMismatch = false;
          mismatchReportedRef.current = false;
        }
      } else {
        mismatchCountRef.current += 1;
        matchCountRef.current = 0;

        if (mismatchCountRef.current >= REQUIRED_MISMATCHES) {
          hasConfirmedMismatch = true;

          if (!mismatchReportedRef.current) {
            await reportMismatch();
            mismatchReportedRef.current = true;
            console.log('[FaceRecognitionDebug] anomaly sent', { distance });
          }
        }
      }

      // We always publish the current frame result so the overlay can say Unknown early,
      // but only the consecutive mismatch rule turns it into a real anomaly.
      onRecognitionResult?.([recognition]);
      onMismatchChange?.(hasConfirmedMismatch);

      console.log('[FaceRecognitionDebug] comparison', {
        distance,
        rawMatch,
        matchCount: matchCountRef.current,
        mismatchCount: mismatchCountRef.current,
        confirmedMismatch: hasConfirmedMismatch,
      });

      updateDebugInfo({
        currentFrameFaces: Math.max(detections.length, faces.length, 1),
        recognizedFaces: recognition.isMatch ? 1 : 0,
        newRecognitions: 1,
        processingTime: performance.now() - startTime,
        backendStatus: 'success',
        errorMessage: hasConfirmedMismatch ? 'Face mismatch detected and reported.' : undefined,
      });
    } catch (error) {
      console.error('[FaceRecognitionComponent] Recognition failed:', error);
      onMismatchChange?.(false);
      publishNeutralBehavior();
      updateDebugInfo({
        processingTime: performance.now() - startTime,
        backendStatus: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    demoMode,
    isReady,
    onBehaviorResult,
    onMismatchChange,
    onRecognitionResult,
    publishNeutralBehavior,
    reportMismatch,
    updateDebugInfo,
    updateBaseline,
    videoRef,
    getStableState,
  ]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const intervalId = setInterval(() => {
      void processRecognition();
    }, VERIFY_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isReady, processRecognition]);

  return null;
};

export default FaceRecognitionComponent;
