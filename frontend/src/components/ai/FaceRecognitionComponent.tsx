import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { useReportAnomalyImage } from '@/hooks/hooks';
import { useCourseStore } from '@/store/course-store';
import type {
  FaceRecognition,
  FaceRecognitionComponentProps,
  FaceRecognitionDebugInfo,
  FaceBehaviorStatus,
} from '@/types/ai.types';

const EMBEDDING_LENGTH = 128;
const VERIFY_INTERVAL_MS = 700;
const MATCH_THRESHOLD = 0.6;
const REQUIRED_MATCHES = 3;
const REQUIRED_MISMATCHES = 2;
const LOOKING_DOWN_HOLD_MS = 900;
const SLOUCHING_HOLD_MS = 1200;
const SLEEPY_HOLD_MS = 1500;
const YAWN_HOLD_MS = 1000;
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

const getAverageY = (points: faceapi.Point[]) => {
  if (!points.length) return 0;
  return points.reduce((sum, point) => sum + point.y, 0) / points.length;
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
    faceCenterYRatio: number | null;
    samples: number;
  }>({
    eyeAspectRatio: null,
    mouthAspectRatio: null,
    headDownScore: null,
    faceCenterYRatio: null,
    samples: 0,
  });
  const lastBehaviorRef = useRef<FaceBehaviorStatus | null>(null);
  const lastFaceSeenAtRef = useRef<number>(0);
  const timersRef = useRef<{
    lookingDownSince: number | null;
    slouchingSince: number | null;
    sleepySince: number | null;
    yawningSince: number | null;
  }>({
    lookingDownSince: null,
    slouchingSince: null,
    sleepySince: null,
    yawningSince: null,
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
    });
  }, [onBehaviorResult]);

  const getHeldState = useCallback((
    key: keyof typeof timersRef.current,
    detected: boolean,
    holdMs: number,
    now: number
  ) => {
    const timers = timersRef.current;

    if (!detected) {
      timers[key] = null;
      return false;
    }

    if (!timers[key]) {
      timers[key] = now;
      return false;
    }

    return now - timers[key]! >= holdMs;
  }, []);

  const updateBaseline = useCallback((
    eyeAspectRatio: number,
    mouthAspectRatio: number,
    headDownScore: number,
    faceCenterYRatio: number
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
    baseline.faceCenterYRatio =
      baseline.faceCenterYRatio === null
        ? faceCenterYRatio
        : baseline.faceCenterYRatio * (1 - alpha) + faceCenterYRatio * alpha;
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
      const jaw = landmarks.getJawOutline();
      const chinY = jaw.length > 8 ? jaw[8].y : eyeCenterY;
      const postureDropScore = Math.max(chinY - eyeCenterY, 0) / Math.max(video.videoHeight, 1);
      const faceCenterYRatio =
        (detection.detection.box.y + detection.detection.box.height / 2) / Math.max(video.videoHeight, 1);

      const baseline = baselineRef.current;
      const hasBaseline = baseline.samples >= 4 &&
        baseline.eyeAspectRatio !== null &&
        baseline.mouthAspectRatio !== null &&
        baseline.headDownScore !== null &&
        baseline.faceCenterYRatio !== null;

      // Keep adapting the neutral baseline when the face looks normal.
      if (!hasBaseline) {
        updateBaseline(eyeAspectRatio, mouthAspectRatio, headDownScore, faceCenterYRatio);
      }

      const eyeBaseline = baseline.eyeAspectRatio ?? eyeAspectRatio;
      const mouthBaseline = baseline.mouthAspectRatio ?? Math.max(mouthAspectRatio, 0.12);
      const headBaseline = baseline.headDownScore ?? headDownScore;
      const faceCenterBaseline = baseline.faceCenterYRatio ?? faceCenterYRatio;

      const rawLookingDown =
        headDownScore > Math.max(headBaseline + 0.05, 0.16) ||
        postureDropScore > 0.16;
      const rawSlouching =
        headDownScore > Math.max(headBaseline + 0.1, 0.22) ||
        postureDropScore > 0.22 ||
        faceCenterYRatio > faceCenterBaseline + 0.08;
      const rawSleepy = eyeAspectRatio < Math.max(eyeBaseline * 0.72, 0.16);
      const rawYawning = mouthAspectRatio > Math.max(mouthBaseline * 1.9, 0.55);

      const isLookingDown = getHeldState('lookingDownSince', rawLookingDown, LOOKING_DOWN_HOLD_MS, now);
      const isSlouching = getHeldState('slouchingSince', rawSlouching, SLOUCHING_HOLD_MS, now);
      const isSleepy = getHeldState('sleepySince', rawSleepy, SLEEPY_HOLD_MS, now);
      const isYawning = getHeldState('yawningSince', rawYawning, YAWN_HOLD_MS, now);

      if (!isLookingDown && !isSleepy && !isYawning && !isSlouching) {
        updateBaseline(eyeAspectRatio, mouthAspectRatio, headDownScore, faceCenterYRatio);
      }

      const fatigueScore = Number(
        (
          (isSleepy ? 0.45 : 0) +
          (isYawning ? 0.25 : 0) +
          (isLookingDown ? 0.15 : 0) +
          (isSlouching ? 0.2 : 0)
        ).toFixed(2)
      );
      const isFatigued = fatigueScore >= 0.45;

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
      };
      lastBehaviorRef.current = behavior;

      onBehaviorResult?.(behavior);

      const liveEmbedding = normalizeEmbedding(Array.from(detection.descriptor));
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
    getHeldState,
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
