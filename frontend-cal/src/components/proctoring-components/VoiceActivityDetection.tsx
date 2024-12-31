import React, { useEffect, useState } from "react";
import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";


interface VoiceActivityDetectionProps {
  filesetResolver: typeof FilesetResolver;
}

const VoiceActivityDetection: React.FC<VoiceActivityDetectionProps> = ({ filesetResolver }) => {
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [isSpeaking, setIsSpeaking] = useState("No");

  const MODEL_URL = "src/models/yamnet.tflite";
  const CACHE_NAME = "tflite-model-cache";

  useEffect(() => {
    const initialize = async () => {
      try {
        // Request microphone permissions early
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Create AudioClassifier
        const modelUrl = await cacheModel(MODEL_URL);
        const classifier = await AudioClassifier.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: modelUrl,
          },
        });

        // Ensure AudioContext is ready
        const localAudioCtx = getOrCreateAudioContext();
        if (localAudioCtx.state === "suspended") {
          await localAudioCtx.resume();
        }

        // Start streaming classification
        handleStreamClassification(classifier);
      } catch (error) {
        console.error("Error initializing VoiceActivityDetection:", error);
      }
    };

    // Automatically initialize on mount
    initialize();

    // Fallback: Resume AudioContext on user interaction if suspended
    const resumeAudioContextOnInteraction = () => {
      const localAudioCtx = getOrCreateAudioContext();
      if (localAudioCtx.state === "suspended") {
        localAudioCtx.resume();
      }
    };

    window.addEventListener("click", resumeAudioContextOnInteraction);
    window.addEventListener("keydown", resumeAudioContextOnInteraction);

    return () => {
      window.removeEventListener("click", resumeAudioContextOnInteraction);
      window.removeEventListener("keydown", resumeAudioContextOnInteraction);
    };
  }, []);

  const cacheModel = async (url: string): Promise<string> => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      console.log("Model loaded from cache:", url);
      return url;
    }

    console.log("Downloading model and caching it...");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.statusText}`);
    }

    await cache.put(url, response);
    console.log("Model cached successfully.");
    return url;
  };

  const getOrCreateAudioContext = () => {
    if (!audioCtx) {
      const newAudioCtx = new AudioContext();
      setAudioCtx(newAudioCtx);
      return newAudioCtx;
    }
    return audioCtx;
  };

  const handleStreamClassification = async (classifier: AudioClassifier) => {
    try {
      const localAudioCtx = getOrCreateAudioContext();

      if (localAudioCtx.state === "suspended") {
        await localAudioCtx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = localAudioCtx.createMediaStreamSource(stream);
      const scriptNode = localAudioCtx.createScriptProcessor(16384, 1, 1);

      scriptNode.onaudioprocess = (event) => {
        try {
          const inputData = event.inputBuffer.getChannelData(0);
          const results = classifier.classify(inputData);

          if (results?.length > 0) {
            const categories = results[0]?.classifications[0]?.categories;

            if (
              categories &&
              categories[0]?.categoryName === "Speech" &&
              parseFloat(categories[0]?.score.toFixed(3)) > 0.5
            ) {
              setIsSpeaking("Yes");
            } else {
              setIsSpeaking("No");
            }
          } else {
            console.warn("No classifications found in results.");
          }
        } catch (error) {
          console.error("Error during classification:", error);
        }
      };

      source.connect(scriptNode);
      scriptNode.connect(localAudioCtx.destination);
    } catch (error) {
      console.error("Error accessing microphone or processing audio:", error);
    }
  };

  return (
    <div>
      <h4>Speaking: {isSpeaking}</h4>
    </div>
  );
};

export default VoiceActivityDetection;
