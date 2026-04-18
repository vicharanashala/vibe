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
  settings:{
    isFaceCountDetectionEnabled:boolean, 
    isFaceRecognitionEnabled:boolean, 
    isFocusEnabled: boolean
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
}

export interface FaceRecognitionOverlayProps {
  recognitions: FaceRecognition[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}

export interface SpeechDetectorProps {
  setIsSpeaking: (value: string) => void;
}

export interface GestureDetectorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trigger: boolean;
  setGesture: (gesture: string) => void;
}

export type MLProcessor = (image: ImageBitmap) => void;