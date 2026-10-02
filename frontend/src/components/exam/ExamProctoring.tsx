import React, { useCallback, useEffect, useRef, useState } from "react";

import BlurDetection from "@/components/ai/BlurDetector";
import SpeechDetector from "@/components/ai/SpeechDetector";
import FaceDetectors from "@/components/ai/FaceDetectors";
import useCameraProcessor from "@/components/ai/useCameraProcessor";
import { FaceRegistrationModal } from "@/components/ai/FaceRegistrationModal";
import { runProctoringChecks } from "@/utils/proctoring/proctoringGuard";
import { getStream } from "@/lib/MediaRegistry";
import type { ExamProctoringConfig, ProctoringDetectorSetting } from "@/lib/api/exams";

// Much smaller, exam-specific cousin of `components/floating-video.tsx`
// (the lesson-flow proctoring orchestrator). Reuses the same detection
// primitives (camera pipeline, face-count/face-recognition/blur/voice
// detectors, virtual-camera guard) but strips everything that doesn't apply
// to a live timed exam: no pop-out/PIP window, no penalty-point threshold,
// no gesture challenge, and no course-shaped anomaly image/audio reporting.
// Violations are surfaced two ways: `onEvent` (fired once per transition,
// for the host page to log into the submitted attempt) and
// `onBlockingChange` (fired on every change to the "should the exam content
// be blurred right now" state, so the host page can render/clear a blur
// overlay — the timer itself lives in the host page and is never touched
// here, so it keeps counting through a blur exactly like a normal warning).
//
// IMPORTANT: no `courseStore` import here — that would be a sign lesson-only
// coupling has leaked back in.

// Detectors that are ON by default when an exam has no teacher-configured
// proctoring settings at all (e.g. the always-available client-side demo
// exam, which has no backend-managed `proctoring` object). Voice detection
// is included so an unconfigured exam still actually monitors for talking,
// not just faces.
const DEFAULT_ENABLED_DETECTORS = new Set(["faceCountDetection", "cameraMic", "voiceDetection"]);

// Anomaly types severe enough to blur the exam content until resolved.
// Everything else (blurDetection, cameraIntegrity) still gets logged and
// shown in the status pill, but doesn't blur — those are softer signals
// (camera quality / virtual-camera heuristics) prone to false positives.
const BLOCKING_ANOMALY_TYPES = new Set([
  "noFace",
  "cameraOff",
  "multipleFaces",
  "voiceDetection",
  "faceRecognition",
]);

// Same detector EditExamPage.jsx force-disables (mirrors the course-lesson
// settings modal, which does the same with no documented reason — treat as
// "known unreliable" rather than a UI-only restriction). Enforced again here
// so a stale exam document saved before that lockdown existed can't still
// enable it.
const FORCE_DISABLED_DETECTORS = new Set(["blurDetection"]);

// Evidence thumbnails, not full-res photos — kept small since multiple
// violations can accumulate across a single attempt and all get submitted
// together in one request body.
const MAX_SNAPSHOT_WIDTH = 320;
const MAX_SNAPSHOT_HEIGHT = 240;

export function isDetectorEnabled(
  detectors: ProctoringDetectorSetting[] | undefined,
  detectorName: string
): boolean {
  if (FORCE_DISABLED_DETECTORS.has(detectorName)) return false;
  if (!detectors) return DEFAULT_ENABLED_DETECTORS.has(detectorName);
  const detector = detectors.find((d) => d.detectorName === detectorName);
  return detector?.enabled ?? false;
}

// Detector names that default on when `settings` is entirely undefined —
// exported so the host page (ExamPage.jsx) can decide whether to show the
// camera-consent step for a not-yet-configured exam using the exact same
// default this component itself applies.
export const DEFAULT_PROCTORING_DETECTORS: readonly string[] = Array.from(DEFAULT_ENABLED_DETECTORS);

const ANOMALY_LABELS: Record<string, string> = {
  noFace: "No face in frame",
  cameraOff: "Camera turned off",
  multipleFaces: "Multiple faces detected",
  blurDetection: "Camera view is blurry",
  voiceDetection: "Voice detected",
  faceRecognition: "Face doesn't match registered identity",
  cameraIntegrity: "Camera integrity issue",
};

export interface ExamProctoringProps {
  /** The exam's `proctoring` field. `undefined` means "not configured" — falls back to the default detector set above. */
  settings?: ExamProctoringConfig;
  /**
   * Called once per anomaly-type transition (absent -> present), never
   * repeatedly while the same anomaly stays active. `imageDataUrl` is a
   * downscaled JPEG snapshot (max ~320x240) taken from the camera preview at
   * the moment of the transition — included only for BLOCKING_ANOMALY_TYPES
   * (the serious, blur-worthy anomalies), and only when the video actually
   * had a frame ready. It's `undefined` for the softer, non-blocking signals
   * (blurDetection/cameraIntegrity) and whenever there was nothing to
   * capture (e.g. camera genuinely off).
   */
  onEvent: (type: string, imageDataUrl?: string) => void;
  /** Called whenever the "should the exam content be blurred" state changes, with the current reasons. */
  onBlockingChange: (isBlocking: boolean, reasons: string[]) => void;
}

export default function ExamProctoring({ settings, onEvent, onBlockingChange }: ExamProctoringProps) {
  const detectors = settings?.detectors;

  const isBlurDetectionEnabled = isDetectorEnabled(detectors, "blurDetection");
  const isFaceCountDetectionEnabled = isDetectorEnabled(detectors, "faceCountDetection");
  const isVoiceDetectionEnabled = isDetectorEnabled(detectors, "voiceDetection");
  const isFaceRecognitionEnabled = isDetectorEnabled(detectors, "faceRecognition");
  const isRightClickDisabled = isDetectorEnabled(detectors, "rightClickDisabled");

  const { videoRef, modelReady, faces } = useCameraProcessor(4);

  const [isBlur, setIsBlur] = useState("No");
  const [isSpeaking, setIsSpeaking] = useState("No");
  const [hasFaceMismatch, setHasFaceMismatch] = useState(false);
  const [showFaceRegisterModal, setShowFaceRegisterModal] = useState(false);
  const [cameraIntegrityFlag, setCameraIntegrityFlag] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [activeAnomalies, setActiveAnomalies] = useState<string[]>([]);

  // Tracks which anomaly types were active on the previous tick, so onEvent
  // only fires on an absent -> present transition instead of every tick.
  const activeAnomalyTypesRef = useRef<Set<string>>(new Set());
  const wasBlockingRef = useRef(false);

  // ---- draggable floating widget ----------------------------------------
  // Simple drag-within-viewport (no resize/pop-out — a separate OS window
  // would work against the whole point of exam proctoring). Starts bottom-left.
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStateRef.current = {
      dragging: true,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.dragging) return;
      const el = containerRef.current;
      if (!el) return;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const x = Math.min(Math.max(0, e.clientX - dragStateRef.current.offsetX), window.innerWidth - width);
      const y = Math.min(Math.max(0, e.clientY - dragStateRef.current.offsetY), window.innerHeight - height);
      setPosition({ x, y });
    };
    const onMouseUp = () => {
      dragStateRef.current.dragging = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Right-click disable, scoped to this component's lifetime only (not a
  // global toggle) — same pattern as floating-video.tsx:212-223.
  useEffect(() => {
    if (!isRightClickDisabled) return;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isRightClickDisabled]);

  // Periodic virtual-camera / stream-quality guard, plus a "did the camera
  // actually get turned off" check (track ended, or disabled by the OS/user
  // after consent was already granted) — unlike the lesson flow, a violation
  // here is only ever flagged for the blur overlay below; the stream itself
  // is never stopped and the exam/timer state is never touched directly.
  useEffect(() => {
    const check = async () => {
      const stream = getStream("CameraProcessor-stream");
      if (!stream) {
        setCameraOff(true);
        return;
      }
      const videoTrack = stream.getVideoTracks()[0];
      setCameraOff(!videoTrack || videoTrack.readyState !== "live" || !videoTrack.enabled);

      try {
        const violations = await runProctoringChecks(stream);
        setCameraIntegrityFlag(violations.length > 0);
      } catch {
        // Never let a transient guard failure affect the exam.
      }
    };
    check();
    const intervalId = window.setInterval(check, 3000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Grabs a downscaled evidence thumbnail from the preview widget's own
  // <video> element for a flagged violation — same canvas-snapshot pattern
  // as floating-video.tsx:268-276, but capped at ~320x240 and re-encoded as
  // a lower-quality JPEG (0.6) since this is just a thumbnail for a teacher
  // to skim, not a full-res photo, and events accumulate across an attempt.
  // Never throws: returns undefined (no image, event still fires) if the
  // video has no frame ready yet or the canvas fails for any reason — this
  // must never interrupt the detection loop or the exam itself.
  const captureSnapshot = useCallback((): string | undefined => {
    try {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return undefined;
      const scale = Math.min(
        MAX_SNAPSHOT_WIDTH / video.videoWidth,
        MAX_SNAPSHOT_HEIGHT / video.videoHeight,
        1
      );
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.6);
    } catch {
      return undefined;
    }
  }, [videoRef]);

  // Per-tick anomaly computation (simplified from floating-video.tsx:560-715):
  // no penalty points, no pause/rewind, no gesture challenge — just derive
  // the active anomaly list, notify on new transitions, and notify on any
  // change to the blocking (blur-worthy) subset.
  useEffect(() => {
    const next: string[] = [];

    if (cameraOff) next.push("cameraOff");
    if (isFaceCountDetectionEnabled && modelReady && !cameraOff) {
      if (faces.length === 0) next.push("noFace");
      else if (faces.length > 1) next.push("multipleFaces");
    }
    if (isBlurDetectionEnabled && isBlur === "Yes") next.push("blurDetection");
    if (isVoiceDetectionEnabled && isSpeaking === "Yes") next.push("voiceDetection");
    if (isFaceRecognitionEnabled && hasFaceMismatch) next.push("faceRecognition");
    if (cameraIntegrityFlag) next.push("cameraIntegrity");

    const prevActive = activeAnomalyTypesRef.current;
    const nextActive = new Set(next);
    for (const type of nextActive) {
      if (!prevActive.has(type)) {
        // Only the serious, blur-worthy anomalies get a screenshot — the
        // softer signals (blurDetection/cameraIntegrity) are still logged,
        // just without evidence imagery.
        const imageDataUrl = BLOCKING_ANOMALY_TYPES.has(type) ? captureSnapshot() : undefined;
        onEvent(type, imageDataUrl);
      }
    }
    activeAnomalyTypesRef.current = nextActive;
    setActiveAnomalies(next);

    const blockingReasons = next.filter((type) => BLOCKING_ANOMALY_TYPES.has(type));
    const isBlocking = blockingReasons.length > 0;
    if (isBlocking !== wasBlockingRef.current || isBlocking) {
      // Fire whenever the blocking state changes, and on every tick while
      // still blocking (reasons can change, e.g. noFace -> multipleFaces).
      onBlockingChange(isBlocking, blockingReasons.map((type) => ANOMALY_LABELS[type] || type));
    }
    wasBlockingRef.current = isBlocking;
  }, [
    cameraOff,
    isFaceCountDetectionEnabled,
    modelReady,
    faces,
    isBlurDetectionEnabled,
    isBlur,
    isVoiceDetectionEnabled,
    isSpeaking,
    isFaceRecognitionEnabled,
    hasFaceMismatch,
    cameraIntegrityFlag,
    captureSnapshot,
    onEvent,
    onBlockingChange,
  ]);

  // Clear any lingering blur overlay if this component unmounts mid-exam.
  useEffect(() => {
    return () => {
      if (wasBlockingRef.current) onBlockingChange(false, []);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMissingEmbedding = useCallback(() => {
    setShowFaceRegisterModal(true);
  }, []);

  const handleFaceRegistrationDone = useCallback(() => {
    setShowFaceRegisterModal(false);
  }, []);

  const isClear = activeAnomalies.length === 0;
  const statusText = isClear
    ? "Monitoring"
    : activeAnomalies.map((type) => ANOMALY_LABELS[type] || type).join(", ");

  return (
    <>
      {/* Small, draggable, always-visible status pill + webcam preview.
          Move it by dragging the header bar. Never itself blocks input —
          the separate blur overlay (rendered by the host page) does that. */}
      <div
        ref={containerRef}
        // Default (undragged) position is nudged up via `bottom-28` on
        // narrow viewports — plain `bottom: 16` used to sit directly under
        // the exam's footer action bar, which can wrap onto 2 lines on a
        // phone-width screen and would otherwise collide with this widget.
        // Once the candidate drags it, `position` takes over via inline
        // style and this responsive default no longer applies.
        className={`fixed z-[9998] w-36 select-none overflow-hidden rounded-lg border border-border bg-black shadow-lg sm:w-44 ${
          position ? "" : "bottom-28 left-2 sm:bottom-4 sm:left-4"
        }`}
        style={position ? { left: position.x, top: position.y } : undefined}
      >
        <div
          onMouseDown={onHeaderMouseDown}
          className={`flex cursor-grab items-center gap-1 px-2 py-1 text-[11px] font-medium leading-tight text-white active:cursor-grabbing ${
            isClear ? "bg-green-600" : "bg-amber-600"
          }`}
          title="Drag to move"
        >
          <span className="truncate">{isClear ? "✅ " : "⚠️ "}{statusText}</span>
        </div>
        <video ref={videoRef} autoPlay muted playsInline className="h-24 w-full object-cover" />
      </div>

      {/* Headless detector children — hidden, no visual output of their own. */}
      <div className="hidden">
        {isBlurDetectionEnabled && <BlurDetection videoRef={videoRef} setIsBlur={setIsBlur} />}
        {isVoiceDetectionEnabled && <SpeechDetector setIsSpeaking={setIsSpeaking} />}
        {(isFaceCountDetectionEnabled || isFaceRecognitionEnabled) && (
          <FaceDetectors
            faces={faces}
            setIsFocused={() => {}}
            videoRef={videoRef}
            onMismatchChange={setHasFaceMismatch}
            onMissingEmbedding={handleMissingEmbedding}
            settings={{
              isFaceCountDetectionEnabled,
              isFaceRecognitionEnabled,
              isFocusEnabled: false,
            }}
          />
        )}
      </div>

      {isFaceRecognitionEnabled && showFaceRegisterModal && (
        <FaceRegistrationModal
          isOpen={showFaceRegisterModal}
          onSuccess={handleFaceRegistrationDone}
          onClose={handleFaceRegistrationDone}
        />
      )}
    </>
  );
}
