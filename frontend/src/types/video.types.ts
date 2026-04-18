// Props for the video player component
export interface VideoProps {
  URL: string;
  startTime?: string;
  endTime?: string;
  points?: string;
  doGesture?: boolean;
  onNext?: () => void;
  isProgressUpdating?: boolean;
  rewindVid: boolean;
  pauseVid: boolean;
  onDurationChange?: (duration: number) => void;

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
      PlayerState: { PLAYING: number };
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

export interface Video{
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