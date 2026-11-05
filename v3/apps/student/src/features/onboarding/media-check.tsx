import { runMediaChecks } from '@vibe/proctoring';
import { CameraIcon, CheckCircle2Icon, MicIcon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ProgressBar } from '@/features/courses/course-ui';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type MediaCheckStatus = 'idle' | 'requesting' | 'passed' | 'blocked' | 'failed';

/**
 * Asks for camera + microphone the same way a proctored lesson does, shows a
 * live preview, runs the proctoring camera checks and shows a mic level meter.
 * The stream is released as soon as the component unmounts.
 */
export function MediaCheck({ onStatusChange }: { onStatusChange?: (status: MediaCheckStatus) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<MediaCheckStatus>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const update = useCallback(
    (next: MediaCheckStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (status !== 'passed' || !streamRef.current) return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(streamRef.current).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setLevel(Math.min(1, data.reduce((a, b) => a + b, 0) / data.length / 60));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      void ctx.close();
    };
  }, [status]);

  async function start() {
    setProblem(null);
    update('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const violations = runMediaChecks(stream);
      if (violations.length > 0) {
        stream.getTracks().forEach((t) => t.stop());
        setProblem(violations[0].reason);
        update('failed');
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      update('passed');
    } catch (error) {
      const name = (error as DOMException)?.name;
      setProblem(
        name === 'NotAllowedError'
          ? 'Camera or microphone access was blocked. Allow both in your browser’s site settings, then try again.'
          : name === 'NotFoundError'
            ? 'We couldn’t find a camera and microphone on this device.'
            : 'We couldn’t start your camera and microphone. Close other apps using them and try again.',
      );
      update(name === 'NotAllowedError' ? 'blocked' : 'failed');
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-muted">
        <video ref={videoRef} autoPlay playsInline muted className={cn('size-full -scale-x-100 object-cover', status !== 'passed' && 'hidden')} />
        {status !== 'passed' && (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <CameraIcon className="size-10" aria-hidden />
          </div>
        )}
      </div>

      {status === 'passed' ? (
        <ItemGroup className="grid w-full gap-2 sm:grid-cols-2" aria-live="polite">
          <Item variant="outline" size="sm">
            <ItemMedia>
              <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="font-normal">Camera is working</ItemTitle>
            </ItemContent>
          </Item>
          <Item variant="outline" size="sm">
            <ItemMedia>
              <MicIcon className="size-4 text-emerald-600" aria-hidden />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="font-normal">Microphone</ItemTitle>
            </ItemContent>
            <ItemActions className="w-20">
              <ProgressBar value={level * 100} label="Microphone level" className="[&_[data-slot=progress-indicator]]:transition-none" />
            </ItemActions>
          </Item>
        </ItemGroup>
      ) : (
        <Button type="button" size="lg" onClick={start} disabled={status === 'requesting'}>
          {status === 'requesting' ? <Spinner /> : <CameraIcon />}
          {status === 'idle' || status === 'requesting' ? 'Allow camera & microphone' : 'Try again'}
        </Button>
      )}

      {problem && (
        <Alert variant="destructive" className="text-left">
          <TriangleAlertIcon />
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
