// Transcribe a video or audio file in the browser with Whisper (transformers.js),
// so Smart Bloom's direct mode can get a timed transcript without the AI server
// or YouTube. Runs in the existing whisper worker; the model is downloaded from
// Hugging Face on first use and cached by the browser.

import type { TranscriptChunk } from "@/lib/smart-bloom-direct-api";

export const WHISPER_SAMPLE_RATE = 16_000;

/**
 * The whole file is read into memory to decode its audio, so very large videos
 * can crash the tab. Above this, ask for an audio-only file instead.
 */
export const MAX_MEDIA_FILE_BYTES = 1024 * 1024 * 1024;

export interface BrowserWhisperModel {
  id: string;
  label: string;
  /** Approximate first-time download, quantized English model. */
  downloadMB: number;
}

// English-only models: the worker appends ".en" when multilingual is off.
export const BROWSER_WHISPER_MODELS: BrowserWhisperModel[] = [
  // On an M4 laptop (CPU/WASM): base ran ~2.6x faster than real time; small was
  // slower than real time for a small gain in accuracy.
  { id: "Xenova/whisper-base", label: "Faster (base, recommended)", downloadMB: 80 },
  { id: "Xenova/whisper-small", label: "Slightly more accurate (small, much slower)", downloadMB: 250 },
];

export const DEFAULT_BROWSER_WHISPER_MODEL = BROWSER_WHISPER_MODELS[0].id;

export type TranscriptionProgress =
  | { stage: "decoding" }
  | { stage: "loading-model"; percent: number }
  | { stage: "transcribing"; processedSeconds: number; totalSeconds: number };

type RawChunk = { text: string; timestamp: [number, number | null] };

/** Average all channels into one, as Whisper expects mono audio. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const length = Math.min(...channels.map((channel) => channel.length));
  const mono = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i++) mono[i] += channel[i];
  }
  for (let i = 0; i < length; i++) mono[i] /= channels.length;
  return mono;
}

/**
 * Whisper's chunks, cleaned up for the Smart Bloom segment endpoint: trimmed,
 * empty lines dropped, and every chunk given an end time. Whisper leaves the
 * last chunk's end as null when the audio stops mid-sentence.
 */
export function toTranscriptChunks(raw: RawChunk[], durationSeconds: number): TranscriptChunk[] {
  const kept = raw
    .map((chunk) => ({ text: chunk.text.trim(), start: chunk.timestamp[0], end: chunk.timestamp[1] }))
    .filter((chunk) => chunk.text && Number.isFinite(chunk.start));

  return kept.map((chunk, i) => {
    const start = Math.max(0, chunk.start);
    const fallbackEnd = i + 1 < kept.length ? kept[i + 1].start : durationSeconds;
    const end = chunk.end ?? fallbackEnd;
    return { timestamp: [start, Math.max(start, end)], text: chunk.text };
  });
}

/** Decode any browser-playable audio or video file to 16 kHz mono samples. */
export async function decodeMediaToMono(file: File): Promise<{ audio: Float32Array; durationSeconds: number }> {
  const data = await file.arrayBuffer();
  const context = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE });
  try {
    const decoded = await context.decodeAudioData(data);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    return { audio: mixToMono(channels), durationSeconds: decoded.duration };
  } catch {
    throw new Error(
      `Could not read the audio in ${file.name}. Try an MP4, WebM, MP3, M4A or WAV file.`,
    );
  } finally {
    void context.close();
  }
}

/**
 * Transcribe a video or audio file in a background worker. Resolves with timed
 * chunks; rejects if the file cannot be decoded, the model fails to load, or
 * the signal aborts (the worker is terminated, so the work really stops).
 */
export async function transcribeMediaFile(
  file: File,
  options: {
    model?: string;
    onProgress?: (progress: TranscriptionProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<TranscriptChunk[]> {
  const { model = DEFAULT_BROWSER_WHISPER_MODEL, signal } = options;

  // The worker posts an update per generated token (thousands per lecture);
  // pass on only changes a progress bar can show, so the page is not re-rendered for each.
  let lastReported = "";
  const onProgress = (progress: TranscriptionProgress) => {
    const key =
      progress.stage === "loading-model"
        ? `model:${progress.percent}`
        : progress.stage === "transcribing"
          ? `text:${Math.floor(progress.processedSeconds)}`
          : progress.stage;
    if (key === lastReported) return;
    lastReported = key;
    options.onProgress?.(progress);
  };

  if (file.size > MAX_MEDIA_FILE_BYTES) {
    throw new Error(
      `${file.name} is too large to transcribe in the browser (over 1 GB). ` +
        "Export just the audio (for example as M4A or MP3) and upload that instead.",
    );
  }
  if (signal?.aborted) throw new DOMException("Transcription cancelled.", "AbortError");

  onProgress({ stage: "decoding" });
  const { audio, durationSeconds } = await decodeMediaToMono(file);
  if (signal?.aborted) throw new DOMException("Transcription cancelled.", "AbortError");
  if (!audio.length) throw new Error(`${file.name} has no audio to transcribe.`);

  const worker = new Worker(new URL("../workers/whisperWorker.js", import.meta.url), {
    type: "module",
    name: "smart-bloom-whisper",
  });

  return new Promise<TranscriptChunk[]>((resolve, reject) => {
    // Model files download in parallel; report their combined progress.
    const downloads = new Map<string, { loaded: number; total: number }>();

    const finish = (settle: () => void) => {
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      settle();
    };
    const onAbort = () => finish(() => reject(new DOMException("Transcription cancelled.", "AbortError")));
    signal?.addEventListener("abort", onAbort);

    worker.addEventListener("error", (event) => {
      finish(() => reject(new Error(event.message || "The transcription worker stopped unexpectedly.")));
    });

    worker.addEventListener("message", (event: MessageEvent) => {
      const message = event.data;
      switch (message?.status) {
        case "initiate":
        case "progress": {
          if (message.file && typeof message.total === "number" && message.total > 0) {
            downloads.set(message.file, { loaded: message.loaded ?? 0, total: message.total });
          }
          let loaded = 0;
          let total = 0;
          downloads.forEach((entry) => {
            loaded += entry.loaded;
            total += entry.total;
          });
          onProgress({ stage: "loading-model", percent: total ? Math.round((loaded / total) * 100) : 0 });
          break;
        }
        case "ready":
          onProgress({ stage: "transcribing", processedSeconds: 0, totalSeconds: durationSeconds });
          break;
        case "update": {
          const chunks: RawChunk[] = message.data?.[1]?.chunks ?? [];
          const last = chunks[chunks.length - 1];
          const processedSeconds = last ? (last.timestamp[1] ?? last.timestamp[0]) : 0;
          onProgress({
            stage: "transcribing",
            processedSeconds: Math.min(processedSeconds, durationSeconds),
            totalSeconds: durationSeconds,
          });
          break;
        }
        case "complete": {
          const chunks = toTranscriptChunks(message.data?.chunks ?? [], durationSeconds);
          finish(() =>
            chunks.length
              ? resolve(chunks)
              : reject(new Error(`No speech was recognised in ${file.name}.`)),
          );
          break;
        }
        case "error":
          finish(() =>
            reject(new Error(`Browser transcription failed: ${message.data?.message ?? "unknown error"}`)),
          );
          break;
        default:
          break;
      }
    });

    // Copied, not transferred: for mono files `audio` is the decoded AudioBuffer's own storage.
    worker.postMessage({
      audio,
      model,
      multilingual: false,
      quantized: true,
      subtask: null,
      language: null,
    });
  });
}
