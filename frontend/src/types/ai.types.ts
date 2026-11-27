import { Face, Keypoint } from "@tensorflow-models/face-detection";

export interface BlurDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setIsBlur: (value: string) => void;
}

export interface FaceDetectorsProps {
  faces: Face[],
  setIsFocused: (focused: boolean) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onRecognitionResult?: (recognitions: FaceRecognition[]) => void;
  onDebugInfoUpdate?: (debugInfo: FaceRecognitionDebugInfo) => void;
  onMismatchChange?: (hasMismatch: boolean) => void;
  onMissingEmbedding?: () => void;
  settings:{
    isFaceCountDetectionEnabled:boolean,
    isFaceRecognitionEnabled:boolean,
    isFocusEnabled: boolean,
    /** Admin-configurable, via Proctoring Settings -> faceRecognition detector options. */
    faceMatchThreshold?: number,
    faceRequiredMatches?: number,
    faceRequiredMismatches?: number,
  }
}

export interface FaceRecognition {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  distance: number;
  isMatch: boolean;
}

export interface TrackedFace {
  id: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  distance: number;
  isMatch: boolean;
  lastSeen: number;
  trackingFrames: number;
  confidence: number;
}

export interface FaceRecognitionDebugInfo {
  knownFacesCount: number;
  knownFaceLabels: string[];
  detectedPhotoFaces: number;
  currentFrameFaces: number;
  recognizedFaces: number;
  trackedFaces: number;
  reusedTracks: number;
  newRecognitions: number;
  processingTime?: number;
  lastUpdateTime: number;
  backendStatus: 'loading' | 'success' | 'error';
  errorMessage?: string;
}

export interface FaceRecognitionComponentProps {
  faces: Face[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onRecognitionResult?: (recognitions: FaceRecognition[]) => void;
  onDebugInfoUpdate?: (debugInfo: FaceRecognitionDebugInfo) => void;
  onMismatchChange?: (hasMismatch: boolean) => void;
  onMissingEmbedding?: () => void;
  enabled?: boolean;
  /** Admin-configurable, via Proctoring Settings -> faceRecognition detector
   * options. Each defaults to the original hardcoded value when unset. */
  matchThreshold?: number;
  requiredMatches?: number;
  requiredMismatches?: number;
}

export interface FaceRecognitionOverlayProps {
  recognitions: FaceRecognition[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}

export interface SpeechDetectorProps {
  setIsSpeaking: (value: string) => void;
  /** Reuse this MediaRegistry stream's audio track instead of opening a
   * second getUserMedia({audio:true}) call. Opt-in: omit to self-acquire
   * (the exam flow's standalone SpeechDetector instance does this). */
  preferSharedStreamKey?: string;
}

export interface GestureDetectorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trigger: boolean;
  setGesture: (gesture: string) => void;
}

export type MLProcessor = (image: ImageBitmap) => void;


export interface TranscriptResponse {
  segmentNumber: number;
  timestamp: string;
  questions: TranscriptQuestion[];
}

export interface TranscriptQuestion {
  sno: number;
  question: string;
  hint: string;
  options: TranscriptOptions;
  explanations: TranscriptExplanations;
  correctAnswer: string;
}

export interface TranscriptOptions {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface TranscriptExplanations {
  A: string;
  B: string;
  C: string;
  D: string;
}
