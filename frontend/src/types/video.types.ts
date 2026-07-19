// Props for the video player component
export interface VideoProps {
  URL: string;
  startTime?: string;
  endTime?: string;
  points?: string;
  doGesture?: boolean;
  onNext?: () => void;
  isProgressUpdating?: boolean;
  anomalies?: string[];
  readyToDetect: boolean;
  rewindVid: boolean;
  pauseVid: boolean;
  onDurationChange?: (duration: number) => void;
  keyboardLockEnabled?: boolean;
  focusMode?: boolean;
  linearProgressionEnabled: boolean;
  seekForwardEnabled: boolean;
  isCompleted?: boolean;
  isAlreadyWatched?: boolean;
  completedItemIdsRef: React.RefObject<Set<string>>;
  nextItemId: string;
  cohortId?:string;
  /**
   * Increment this counter to pause the video imperatively WITHOUT showing the
   * proctoring/anomaly overlay (used when the learner clicks a floating control
   * in the focused learn UI). Each change in value triggers a single pause.
   */
  pauseSignal?: number;
  /**
   * Sustained "learner stepped away" pause (cursor left the page). Pausing
   * remembers whether the video was playing; when this returns to false the
   * video auto-resumes (unless blocked by a proctoring anomaly/gesture).
   */
  awayPaused?: boolean;
}



// Minimal YouTube Player instance interface
export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlaybackRate: () => number;
  getDuration: () => number;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  getAvailablePlaybackRates?: () => number[];
  anomalies?: string[];
}

// Extend Window object globally with YT namespace (YouTube IFrame API)
declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLDivElement,
        options: {
          videoId: string;
          playerVars: Record<string, unknown>;
          events: {
            onReady: (event: { target: YTPlayerInstance }) => void;
            onStateChange: (event: { data: number; target: YTPlayerInstance }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: { PLAYING: number; ENDED: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Proctoring settings interface based on the backend structure
export interface IDetectorSettings {
  detectorName: string;
  settings: {
    enabled: boolean;
  };
}

export interface StudentProctoringSettings {
  _id: string;
  studentId?: string;
  versionId: string;
  courseId: string;
  settings: {
    proctors: {
      detectors: IDetectorSettings[];
    };
    linearProgressionEnabled: boolean;
    seekForwardEnabled: boolean;
  };
}

export interface FloatingVideoProps {
  isVisible: boolean;
  onClose: () => void;
  onAnomalyDetected: (hasAnomaly: boolean) => void;
  setDoGesture: (value: boolean) => void;
  settings: StudentProctoringSettings;
  rewindVid: boolean;
  setRewindVid: (value: boolean) => void;
  pauseVid: boolean;
  setPauseVid: (value: boolean) => void;
  setAnomalies: (anomalies: string[]) => void;
  readyToDetect: boolean;
  setReadyToDetect: (value: boolean) => void;
  anomalies?: string[];
}

export interface ProctoringSettings {
  _id: string;
  userId: string;
  versionId: string;
  courseId: string;
  settings: {
    proctors: {
      detectors: {
        detectorName: string;
        settings: {
          enabled: boolean;
        }
      }[]
    }
  }
}

export interface Video {
  _id: string;
  name: string;
  description: string;
  type: string;
  details: {
    URL: string;
    startTime: string;
    endTime: string;
    points: number;
  };
}