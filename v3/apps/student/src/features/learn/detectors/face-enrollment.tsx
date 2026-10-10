import { CameraIcon, Loader2Icon, RotateCcwIcon, ScanFaceIcon } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as faceapi from '@vladmandic/face-api';

import { Button } from '@/components/ui/button';
import { useUpdateFaceReference } from '@/features/courses/queries';

import { FACE_DETECTOR_OPTIONS, FACE_EMBEDDING_LENGTH, loadFaceModels } from './use-face-recognition';

/**
 * One-time reference-photo capture for faceRecognition: this course needs a
 * face on file before it can tell you apart from anyone else, so it's shown
 * in place of the lesson until one is saved.
 */
export function FaceEnrollment({
  videoRef,
  stream,
  courseId,
  versionId,
  onDone,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  courseId: string;
  versionId: string;
  onDone: () => void;
}) {
  const [modelsReady, setModelsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{ dataUrl: string; embedding: number[] } | null>(null);
  const updateFaceReference = useUpdateFaceReference(courseId, versionId);
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    void loadFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => setError('Couldn’t load face recognition. Check your connection and try again.'));
  }, []);

  async function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setCapturing(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Same detector options as live recognition (use-face-recognition.ts) — a
      // different inputSize/threshold here would align landmarks differently
      // and could itself widen the distance between the reference and live checks.
      const detection = await faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions(FACE_DETECTOR_OPTIONS))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection?.descriptor || detection.descriptor.length !== FACE_EMBEDDING_LENGTH) {
        setError('No clear face found. Face the camera directly in good light and try again.');
        return;
      }
      setCaptured({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), embedding: Array.from(detection.descriptor) });
    } catch {
      setError('Couldn’t process that photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }

  function save() {
    if (!captured) return;
    updateFaceReference.mutate(
      { profileImage: captured.dataUrl, faceEmbedding: captured.embedding },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
        <ScanFaceIcon className="size-6" aria-hidden />
      </span>
      <h1 className="font-aleo text-2xl tracking-tight">Add a reference photo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This lesson checks that it’s really you on camera. We need one clear photo on file first — it stays on your account and is
        only compared locally in your browser, never uploaded anywhere else.
      </p>

      {captured ? (
        <>
          <img src={captured.dataUrl} alt="Captured reference" className="mt-6 aspect-square w-56 rounded-2xl border border-border object-cover" />
          {updateFaceReference.isError && <p className="mt-3 text-sm text-destructive">Couldn’t save your photo. Please try again.</p>}
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => setCaptured(null)} disabled={updateFaceReference.isPending}>
              <RotateCcwIcon className="size-4" aria-hidden /> Retake
            </Button>
            <Button onClick={save} disabled={updateFaceReference.isPending}>
              {updateFaceReference.isPending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
              Use this photo
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="relative mt-6 aspect-square w-56 overflow-hidden rounded-2xl border border-border bg-muted">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- live self-view, not a media player */}
            <video ref={previewRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          </div>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          <Button className="mt-6" size="lg" onClick={capture} disabled={!modelsReady || capturing}>
            {capturing || !modelsReady ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <CameraIcon className="size-4" aria-hidden />}
            {modelsReady ? 'Capture photo' : 'Loading…'}
          </Button>
        </>
      )}
    </div>
  );
}
