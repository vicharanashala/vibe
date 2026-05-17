import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

import { useReportAnomalyImage } from '@/hooks/hooks';
import { useCourseStore } from '@/store/course-store';
import type {
  FaceRecognition,
  FaceRecognitionComponentProps,
  FaceRecognitionDebugInfo,
} from '@/types/ai.types';

const EMBEDDING_LENGTH = 128;
const VERIFY_INTERVAL_MS = 1000;
const MATCH_THRESHOLD = 0.6;
const REQUIRED_MATCHES = 3;
const REQUIRED_MISMATCHES = 2;

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

const FaceRecognitionComponent: React.FC<FaceRecognitionComponentProps> = ({
  videoRef,
  onRecognitionResult,
  onDebugInfoUpdate,
  onMismatchChange,
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
  }, [fetchFaceReference, updateDebugInfo]);

  const processRecognition = useCallback(async () => {
    const referenceEmbedding = referenceEmbeddingRef.current;
    const video = videoRef.current;

    if (!isReady || !referenceEmbedding || !video || isProcessingRef.current) {
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    isProcessingRef.current = true;
    const startTime = performance.now();

    try {
      // Keep verification focused on the single student face, just like the simpler working sample.
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection?.descriptor) {
        updateDebugInfo({
          currentFrameFaces: 0,
          recognizedFaces: 0,
          newRecognitions: 0,
          processingTime: performance.now() - startTime,
          errorMessage: 'No face detected in sampled frame.',
          backendStatus: 'success',
        });
        return;
      }

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
            // console.log('[FaceRecognitionDebug] anomaly sent', { distance });
          }
        }
      }

      // We always publish the current frame result so the overlay can say Unknown early,
      // but only the consecutive mismatch rule turns it into a real anomaly.
      onRecognitionResult?.([recognition]);
      onMismatchChange?.(hasConfirmedMismatch);

      // console.log('[FaceRecognitionDebug] comparison', {
      //   distance,
      //   rawMatch,
      //   matchCount: matchCountRef.current,
      //   mismatchCount: mismatchCountRef.current,
      //   confirmedMismatch: hasConfirmedMismatch,
      // });

      updateDebugInfo({
        currentFrameFaces: 1,
        recognizedFaces: recognition.isMatch ? 1 : 0,
        newRecognitions: 1,
        processingTime: performance.now() - startTime,
        backendStatus: 'success',
        errorMessage: hasConfirmedMismatch ? 'Face mismatch detected and reported.' : undefined,
      });
    } catch (error) {
      console.error('[FaceRecognitionComponent] Recognition failed:', error);
      onMismatchChange?.(false);
      updateDebugInfo({
        processingTime: performance.now() - startTime,
        backendStatus: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    isReady,
    onMismatchChange,
    onRecognitionResult,
    reportMismatch,
    resetVerificationState,
    updateDebugInfo,
    videoRef,
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
