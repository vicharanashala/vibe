import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { useReportAnomalyImage } from '@/hooks/hooks';
import { useCourseStore } from '@/store/course-store';
import type {
  FaceRecognition,
  FaceRecognitionComponentProps,
  FaceRecognitionDebugInfo,
} from '@/types/ai.types';

// @vladmandic/human's "faceres" model (see humanFaceWorker.js), not
// face-api.js's 128-length descriptor this replaces.
const EMBEDDING_LENGTH = 1024;
const DEFAULT_MATCH_THRESHOLD = 0.6;
const DEFAULT_REQUIRED_MATCHES = 3;
const DEFAULT_REQUIRED_MISMATCHES = 2;

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

// Human's exact match.ts similarity formula, reimplemented here rather than
// importing the whole library onto the main thread for one small calculation
// -- the actual embedding extraction already happened in humanFaceWorker.js.
// Returns 0..1, higher = more similar (unlike face-api.js's raw Euclidean
// distance, where lower meant more similar).
function embeddingSimilarity(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  const dist = Math.round(100 * 25 * sum) / 100;
  if (dist === 0) return 1;
  const root = Math.sqrt(dist);
  const norm = (1 - root / 100 - 0.2) / (0.8 - 0.2);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}

const FaceRecognitionComponent: React.FC<FaceRecognitionComponentProps> = ({
  faces,
  videoRef,
  onRecognitionResult,
  onDebugInfoUpdate,
  onMismatchChange,
  onMissingEmbedding,
  enabled = true,
  matchThreshold = DEFAULT_MATCH_THRESHOLD,
  requiredMatches = DEFAULT_REQUIRED_MATCHES,
  requiredMismatches = DEFAULT_REQUIRED_MISMATCHES,
}) => {
  const [isReady, setIsReady] = useState(false);
  // Mirrored into refs (not read as useEffect deps) so a settings change
  // doesn't force the comparison effect below to recreate every render.
  const matchThresholdRef = useRef(matchThreshold);
  const requiredMatchesRef = useRef(requiredMatches);
  const requiredMismatchesRef = useRef(requiredMismatches);
  useEffect(() => { matchThresholdRef.current = matchThreshold; }, [matchThreshold]);
  useEffect(() => { requiredMatchesRef.current = requiredMatches; }, [requiredMatches]);
  useEffect(() => { requiredMismatchesRef.current = requiredMismatches; }, [requiredMismatches]);

  const reportImage = useReportAnomalyImage();
  const courseStore = useCourseStore();
  const navigate = useNavigate();
  const missingEmbeddingRedirectedRef = useRef(false);
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

    const course = courseStore.currentCourse;
    const params = new URLSearchParams();
    if (course?.courseId) params.set('courseId', course.courseId);
    if (course?.versionId) params.set('versionId', course.versionId);
    // Lets the backend resolve a selective-proctoring override on this item
    // or module instead of only the course-wide setting (resolveProctoringDetectors'
    // item > module > course precedence) -- without these, a course whose
    // face-recognition is only turned on at the item/module level always
    // withholds an already-registered student's embedding.
    if (course?.moduleId) params.set('moduleId', course.moduleId);
    if (course?.itemId) params.set('itemId', course.itemId);
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${import.meta.env.VITE_BASE_URL}/users/me/face-reference-human${query}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch face reference: ${response.status}`);
    }

    return response.json();
  }, [courseStore.currentCourse]);

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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      try {
        updateDebugInfo({ backendStatus: 'loading', errorMessage: undefined });

        const reference = await fetchFaceReference();
        const normalizedEmbedding = normalizeEmbedding(reference.faceEmbedding);

        if (!normalizedEmbedding || normalizedEmbedding.length !== EMBEDDING_LENGTH) {
          if (onMissingEmbedding) {
            onMissingEmbedding();
          } else {
            if (!missingEmbeddingRedirectedRef.current) {
              missingEmbeddingRedirectedRef.current = true;
              const redirectTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
              toast.error('This course requires a face photo. Please add one to continue.');
              navigate({
                to: '/auth',
                search: { completeFace: '1', redirect: redirectTo } as any,
              });
            }
          }
          return;
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
  // onMissingEmbedding deliberately excluded: floating-video.tsx passes it as
  // a fresh inline arrow function every render, so including it here refired
  // this effect (and its fetch of /face-reference-human) on every one of
  // FloatingVideo's renders -- which happen at the camera's capture rate --
  // compounding into ERR_INSUFFICIENT_RESOURCES within seconds. Only
  // enabled/fetchFaceReference actually changing should re-run this.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchFaceReference, navigate, updateDebugInfo]);

  // Reacts to each fresh detection from the shared humanFaceWorker.js pass
  // (~4fps, via CameraProcessor) instead of running its own separate
  // 1000ms-interval model inference on the main thread -- the embedding was
  // already extracted as part of the same one-pass detect() call that
  // produces the face-count signal, so there's no extra inference cost here,
  // only a cheap comparison.
  useEffect(() => {
    if (!enabled || !isReady || isProcessingRef.current) {
      return;
    }

    const referenceEmbedding = referenceEmbeddingRef.current;
    if (!referenceEmbedding) {
      return;
    }

    isProcessingRef.current = true;
    const startTime = performance.now();

    try {
      const primaryFace = faces[0] as (typeof faces)[number] & { embedding?: number[] | null };

      if (!primaryFace || !primaryFace.embedding || primaryFace.embedding.length !== EMBEDDING_LENGTH) {
        onRecognitionResult?.([]);
        updateDebugInfo({
          currentFrameFaces: faces.length,
          recognizedFaces: 0,
          newRecognitions: 0,
          processingTime: performance.now() - startTime,
          errorMessage: faces.length ? 'Live face data is invalid. Try again.' : 'No face detected in sampled frame.',
          backendStatus: 'success',
        });
        return;
      }

      const sim = embeddingSimilarity(referenceEmbedding, primaryFace.embedding);
      const rawMatch = sim >= matchThresholdRef.current;

      let recognition: FaceRecognition = {
        box: primaryFace.box as FaceRecognition['box'],
        label: rawMatch ? referenceLabelRef.current : 'unknown',
        distance: sim,
        isMatch: rawMatch,
      };
      let hasConfirmedMismatch = mismatchReportedRef.current;

      if (rawMatch) {
        matchCountRef.current += 1;
        mismatchCountRef.current = 0;

        if (matchCountRef.current >= requiredMatchesRef.current) {
          recognition = {
            box: primaryFace.box as FaceRecognition['box'],
            label: referenceLabelRef.current,
            distance: sim,
            isMatch: true,
          };
          hasConfirmedMismatch = false;
          mismatchReportedRef.current = false;
        }
      } else {
        mismatchCountRef.current += 1;
        matchCountRef.current = 0;

        if (mismatchCountRef.current >= requiredMismatchesRef.current) {
          hasConfirmedMismatch = true;

          if (!mismatchReportedRef.current) {
            void reportMismatch();
            mismatchReportedRef.current = true;
          }
        }
      }

      onRecognitionResult?.([recognition]);
      onMismatchChange?.(hasConfirmedMismatch);

      updateDebugInfo({
        currentFrameFaces: faces.length,
        recognizedFaces: recognition.isMatch ? 1 : 0,
        newRecognitions: 1,
        processingTime: performance.now() - startTime,
        backendStatus: 'success',
        errorMessage: hasConfirmedMismatch ? 'Face mismatch detected and reported.' : undefined,
      });
    } catch (error) {
      console.error('[FaceRecognitionComponent] Comparison failed:', error);
      onMismatchChange?.(false);
      updateDebugInfo({
        processingTime: performance.now() - startTime,
        backendStatus: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, [faces, enabled, isReady, onMismatchChange, onRecognitionResult, reportMismatch, updateDebugInfo]);

  return null;
};

export default FaceRecognitionComponent;
