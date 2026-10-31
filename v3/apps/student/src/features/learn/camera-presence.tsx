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

/**
 * Holds a camera (and, when `audio` is requested, microphone) stream open and
 * reports whether it is live — no frames are analysed, captured or sent. Blue
 * track asks for video only; the `cameraMic` proctoring detector asks for both.
 */
export function useCameraPresence(options?: { audio?: boolean; enabled?: boolean }) {
  const { audio = false, enabled = true } = options ?? {};
  const [state, setState] = useState<CameraState>(enabled ? 'starting' : 'off');
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
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio });
      const videoTrack = s.getVideoTracks()[0];
      const audioTrack = audio ? s.getAudioTracks?.()[0] : undefined;
      const sync = () => {
        const videoLive = videoTrack.readyState === 'live' && !videoTrack.muted;
        const audioLive = !audio || (audioTrack?.readyState === 'live' && !audioTrack.muted);
        setState(videoLive && audioLive ? 'on' : 'off');
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
      setState((error as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'off');
    }
  }, [release, audio, enabled]);

  useEffect(() => {
    void start();
    return release;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, audio]);

  return { state, stream, retry: start };
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
