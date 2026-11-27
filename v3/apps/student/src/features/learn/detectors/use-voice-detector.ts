import { useEffect, useState } from 'react';
import { AudioClassifier, FilesetResolver } from '@mediapipe/tasks-audio';

import { voiceAssets } from '../proctoring/assets';
import { loadAssets } from '../proctoring/model-loader';
import { READY, useReadiness, type Readiness } from '../proctoring/readiness';

const SAMPLE_RATE = 16_000;
const PROCESS_INTERVAL_MS = 500;
const SPEECH_SCORE_THRESHOLD = 0.5;

/** A blob URL for downloaded bytes, so a library that wants a URL can use the saved copy. */
function blobUrl(bytes: Uint8Array<ArrayBuffer>, type: string): string {
  return URL.createObjectURL(new Blob([bytes], { type }));
}

/**
 * Classifies the already-open camera stream's audio track with MediaPipe's
 * YAMNet model and reports whether speech is currently present. The runtime
 * and model are downloaded through the shared proctoring loader (pinned,
 * saved on the device, with progress) as soon as the check is on.
 */
export function useVoiceDetector(
  stream: MediaStream | null,
  enabled: boolean,
): { isSpeaking: boolean; readiness: Readiness; retry: () => void } {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [classifier, setClassifier] = useState<AudioClassifier | null>(null);
  const { readiness, attempt, retry, track } = useReadiness();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let created: AudioClassifier | null = null;
    const urls: string[] = [];
    track.begin();
    (async () => {
      const simd = await FilesetResolver.isSimdSupported();
      const { files, fromCache, saved } = await loadAssets(voiceAssets(simd), (progress) => {
        if (!cancelled) track.progress(progress);
      });
      if (cancelled) return;
      track.loaded({ fromCache, saved });
      const fileset = {
        wasmLoaderPath: blobUrl(files['wasm-loader'], 'text/javascript'),
        wasmBinaryPath: blobUrl(files['wasm-binary'], 'application/wasm'),
      };
      urls.push(fileset.wasmLoaderPath, fileset.wasmBinaryPath);
      created = await AudioClassifier.createFromOptions(fileset, { baseOptions: { modelAssetBuffer: files.model } });
      if (cancelled) {
        created.close();
        return;
      }
      setClassifier(created);
      track.ready();
    })().catch((error: unknown) => {
      if (!cancelled) track.fail(error);
    });

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
      created?.close();
      setClassifier(null);
    };
  }, [enabled, attempt, track]);

  useEffect(() => {
    if (!classifier || !stream) {
      setIsSpeaking(false);
      return;
    }
    const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioCtx.createMediaStreamSource(stream);
    // ScriptProcessorNode is deprecated but still broadly supported, and this is a
    // 1:1 port of the old frontend's working implementation — not worth a rewrite
    // onto AudioWorkletNode for this phase.
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    let lastProcessed = 0;
    processor.onaudioprocess = (event) => {
      const now = performance.now();
      if (now - lastProcessed < PROCESS_INTERVAL_MS) return;
      lastProcessed = now;
      try {
        const results = classifier.classify(event.inputBuffer.getChannelData(0), SAMPLE_RATE);
        const top = results[0]?.classifications[0]?.categories?.[0];
        setIsSpeaking(top?.categoryName === 'Speech' && top.score > SPEECH_SCORE_THRESHOLD);
      } catch {
        // Transient classify failure — try again next buffer.
      }
    };
    source.connect(processor);
    processor.connect(audioCtx.destination);

    return () => {
      processor.disconnect();
      source.disconnect();
      void audioCtx.close();
      setIsSpeaking(false);
    };
  }, [classifier, stream]);

  return { isSpeaking, readiness: enabled ? readiness : READY, retry };
}
