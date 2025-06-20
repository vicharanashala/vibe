import React, { useEffect, useRef, useState } from "react";
import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";

interface SpeechDetectorProps {
  setIsSpeaking: (value: string) => void;
}

const SpeechDetector: React.FC<SpeechDetectorProps> = ({ setIsSpeaking }) => {
  const [modelReady, setModelReady] = useState(false);
  const classifierRef = useRef<AudioClassifier | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const lastProcessedRef = useRef<number>(0); // Timestamp tracking
  const MODEL_PATH =
    "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite";

  useEffect(() => {
    const loadModel = async () => {
      try {
        // console.log("[SpeechDetector] 🔄 Loading MediaPipe Model...");
        const filesetResolver = await FilesetResolver.forAudioTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm"
        );

        classifierRef.current = await AudioClassifier.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_PATH },
        });

        setModelReady(true);
        // console.log("[SpeechDetector] ✅ Model Loaded Successfully!");
        startMicrophone();
      } catch (error) {
        // console.error("[SpeechDetector] ❌ Error loading model:", error);
      }
    };

    loadModel();

    return () => {
      stopMicrophone();
    };
  }, []);

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
      scriptNodeRef.current = audioCtxRef.current.createScriptProcessor(4096, 1, 1); // Reduced buffer size

      scriptNodeRef.current.onaudioprocess = async (event) => {
        if (!classifierRef.current) return;

        const now = performance.now();
        if (now - lastProcessedRef.current < 500) return; // Process every 500ms (reduces CPU load)
        lastProcessedRef.current = now;

        const audioData = event.inputBuffer.getChannelData(0);
        processAudio(audioData);
      };

      sourceRef.current.connect(scriptNodeRef.current);
      scriptNodeRef.current.connect(audioCtxRef.current.destination);
      console.log("[SpeechDetector] 🎙️ Microphone Started!");
    } catch (error) {
      console.error("[SpeechDetector] ❌ Error accessing microphone:", error);
    }
  };

  const processAudio = async (audioData: Float32Array) => {
    if (!classifierRef.current) return;

    requestAnimationFrame(() => {
      try {
        const results = classifierRef.current!.classify(audioData, 16000);
        const categories = results[0]?.classifications[0]?.categories;

        const isSpeaking =
          categories?.[0]?.categoryName === "Speech" &&
          parseFloat(categories[0]?.score.toFixed(3)) > 0.5;

        setIsSpeaking(isSpeaking ? "Yes" : "No");
      } catch (error) {
        console.error("[SpeechDetector] ❌ Error processing audio:", error);
      }
    });
  };

  const stopMicrophone = () => {
    if (scriptNodeRef.current) scriptNodeRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioCtxRef.current) audioCtxRef.current.close();

    scriptNodeRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current = null;
  };

  return <></>;
};

export default SpeechDetector;