import { CameraOffIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';

export type CameraState = 'starting' | 'on' | 'off' | 'denied';

/** Why the camera or microphone isn't on, so the student can be told how to fix it. */
export type CameraProblem = 'denied' | 'no-device' | 'busy' | 'unsupported' | 'stopped' | 'unknown';
export type CameraDevice = 'camera' | 'microphone' | 'both';
export interface CameraIssue {
  problem: CameraProblem;
  device: CameraDevice;
}

const DEVICE_NAME: Record<CameraDevice, string> = {
  camera: 'camera',
  microphone: 'microphone',
  both: 'camera or microphone',
};

/** A short title and the fix to show for a camera/microphone problem. */
export function describeCameraIssue({ problem, device }: CameraIssue): { title: string; fix: string } {
  const name = DEVICE_NAME[device];
  switch (problem) {
    case 'denied':
      return {
        title: `${name[0].toUpperCase()}${name.slice(1)} access is blocked`,
        fix: 'Click the camera icon or the lock next to the address bar, allow the camera and microphone for this site, then try again.',
      };
    case 'no-device':
      return { title: `No ${name} found`, fix: `Connect a ${name}, or check it’s turned on and enabled in your computer’s settings, then try again.` };
    case 'busy':
      return {
        title: `Another app is using your ${name}`,
        fix: 'Close other apps or tabs that use it (video calls, other browsers, the camera app), then try again.',
      };
    case 'unsupported':
      return {
        title: `Your ${name} can’t be used here`,
        fix: 'This browser or device doesn’t support what the lesson needs. Try an up-to-date Chrome, Edge or Firefox.',
      };
    case 'stopped':
      return { title: `Your ${name} stopped`, fix: 'It was disconnected, turned off or muted. Turn it back on, then try again.' };
    default:
      return { title: `Your ${name} couldn’t start`, fix: 'Try again. If it keeps happening, reload the page or run diagnostics.' };
  }
}

/** Maps a getUserMedia failure to a problem, checking which kind of device is missing. */
async function issueFrom(error: unknown, audio: boolean): Promise<CameraIssue> {
  const both: CameraDevice = audio ? 'both' : 'camera';
  switch ((error as DOMException)?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return { problem: 'denied', device: both };
    case 'NotFoundError':
    case 'DevicesNotFoundError': {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
      const camera = devices.some((d) => d.kind === 'videoinput');
      const microphone = devices.some((d) => d.kind === 'audioinput');
      return { problem: 'no-device', device: !camera && audio && !microphone ? 'both' : camera && audio ? 'microphone' : 'camera' };
    }
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { problem: 'busy', device: both };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
    case 'TypeError':
      return { problem: 'unsupported', device: both };
    default:
      return { problem: 'unknown', device: both };
  }
}

/**
 * Holds a camera (and, when `audio` is requested, microphone) stream open and
 * reports whether it is live — no frames are analysed, captured or sent. Blue
 * track asks for video only; the `cameraMic` proctoring detector asks for both.
 */
export function useCameraPresence(options?: { audio?: boolean; enabled?: boolean }) {
  const { audio = false, enabled = true } = options ?? {};
  const [state, setState] = useState<CameraState>(enabled ? 'starting' : 'off');
  const [reason, setReason] = useState<CameraIssue | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async () => {
    release();
    if (!enabled) {
      setState('off');
      return;
    }
    setState('starting');
    setReason(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new TypeError('getUserMedia is unavailable');
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio });
      const videoTrack = s.getVideoTracks()[0];
      const audioTrack = audio ? s.getAudioTracks?.()[0] : undefined;
      const sync = () => {
        const videoLive = videoTrack.readyState === 'live' && !videoTrack.muted;
        const audioLive = !audio || (audioTrack?.readyState === 'live' && !audioTrack.muted);
        setState(videoLive && audioLive ? 'on' : 'off');
        setReason(
          videoLive && audioLive ? null : { problem: 'stopped', device: !videoLive && !audioLive ? 'both' : videoLive ? 'microphone' : 'camera' },
        );
      };
      [videoTrack, audioTrack].filter(Boolean).forEach((t) => {
        t!.addEventListener('ended', sync);
        t!.addEventListener('mute', sync);
        t!.addEventListener('unmute', sync);
      });
      streamRef.current = s;
      setStream(s);
      sync();
    } catch (error) {
      const issue = await issueFrom(error, audio);
      setReason(issue);
      setState(issue.problem === 'denied' ? 'denied' : 'off');
    }
  }, [release, audio, enabled]);

  useEffect(() => {
    void start();
    return release;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, audio]);

  return { state, reason, stream, retry: start };
}

/** Small mirrored self-view so students can see the camera is on. */
export function CameraBubble({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  if (!stream) return null;
  return (
    <div className="fixed right-4 bottom-20 z-40 overflow-hidden rounded-2xl border-2 border-sky-500 bg-black shadow-lg sm:bottom-24">
      <video ref={ref} autoPlay playsInline muted aria-label="Your camera" className="h-24 w-32 -scale-x-100 object-cover sm:h-28 sm:w-40" />
    </div>
  );
}

/** Covers the lesson while the camera is off; content is paused underneath. */
export function CameraRequired({
  state,
  onRetry,
  deniedHint,
  idleHint = 'Nothing is recorded or analysed.',
}: {
  state: CameraState;
  onRetry: () => void;
  /** Shown when permission was denied; defaults to a generic prompt. */
  deniedHint?: string;
  /** Shown once permission is otherwise just missing/off. */
  idleHint?: string;
}) {
  if (state === 'on') return null;
  return (
    <AlertDialog open>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="text-sky-600">{state === 'starting' ? <Spinner /> : <CameraOffIcon />}</AlertDialogMedia>
          <AlertDialogTitle>{state === 'starting' ? 'Turning your camera on…' : 'Turn your camera on to continue'}</AlertDialogTitle>
          <AlertDialogDescription>
            {state === 'denied'
              ? (deniedHint ?? 'Camera access is blocked. Allow it in your browser’s site settings, then try again.')
              : idleHint}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state !== 'starting' && (
          <AlertDialogFooter>
            <AlertDialogAction onClick={onRetry}>Try again</AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
