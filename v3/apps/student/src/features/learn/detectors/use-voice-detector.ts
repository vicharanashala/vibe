import { useEffect, useRef, useState } from 'react';
import { AudioClassifier, FilesetResolver } from '@mediapipe/tasks-audio';

const YAMNET_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite';
const WASM_FILESET_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.22-rc.20250304/wasm';
const SAMPLE_RATE = 16_000;
const PROCESS_INTERVAL_MS = 500;
const SPEECH_SCORE_THRESHOLD = 0.5;

/**
 * Classifies the already-open camera stream's audio track with MediaPipe's
 * YAMNet model (loaded from Google's CDN/model host at runtime - no weights
 * bundled) and reports whether speech is currently present.
 */
export function useVoiceDetector(stream: MediaStream | null, enabled: boolean): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const classifierRef = useRef<AudioClassifier | null>(null);

  useEffect(() => {
    if (!enabled || !stream) {
      setIsSpeaking(false);
      return;
    }

    let cancelled = false;
    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;
    let lastProcessed = 0;

    (async () => {
      const fileset = await FilesetResolver.forAudioTasks(WASM_FILESET_URL);
      const classifier = await AudioClassifier.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: YAMNET_MODEL_URL },
      });
      if (cancelled) {
        classifier.close();
        return;
      }
      classifierRef.current = classifier;

      audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      source = audioCtx.createMediaStreamSource(stream);
      // ScriptProcessorNode is deprecated but still broadly supported, and this is a
      // 1:1 port of the old frontend's working implementation — not worth a rewrite
      // onto AudioWorkletNode for this phase.
      processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        const now = performance.now();
        if (now - lastProcessed < PROCESS_INTERVAL_MS || !classifierRef.current) return;
        lastProcessed = now;
        try {
          const results = classifierRef.current.classify(event.inputBuffer.getChannelData(0), SAMPLE_RATE);
          const top = results[0]?.classifications[0]?.categories?.[0];
          setIsSpeaking(top?.categoryName === 'Speech' && top.score > SPEECH_SCORE_THRESHOLD);
        } catch {
          // Transient classify failure — try again next buffer.
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
    })().catch(() => setIsSpeaking(false));

    return () => {
      cancelled = true;
      processor?.disconnect();
      source?.disconnect();
      void audioCtx?.close();
      classifierRef.current?.close();
      classifierRef.current = null;
      setIsSpeaking(false);
    };
  }, [enabled, stream]);

  return isSpeaking;
}
