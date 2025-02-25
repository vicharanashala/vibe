import React, { useEffect, useState } from 'react'
import { AudioClassifier } from '@mediapipe/tasks-audio'

// Define the type for the Wasm fileset resolver
type WasmFileset = any

// Define the props for the VoiceActivityDetection component
interface VoiceActivityDetectionProps {
  filesetResolver: WasmFileset
}

const VoiceActivityDetection: React.FC<VoiceActivityDetectionProps> = ({
  filesetResolver,
}) => {
  // State to track whether the user is speaking or not
  const [isSpeaking, setIsSpeaking] = useState('No')

  // Constants for the model URL, cache name, and confidence threshold for speech detection
  const MODEL_URL = 'src/models/yamnet.tflite'
  const CACHE_NAME = 'tflite-model-cache'
  const confidenceThreshold = 0.5

  // useEffect to initialize the audio processing logic once the component mounts
  useEffect(() => {
    const initialize = async () => {
      try {
        // Request microphone access from the user
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })

        // Load the model and create an audio classifier instance
        const modelUrl = await cacheModel(MODEL_URL)
        const classifier = await AudioClassifier.createFromOptions(
          filesetResolver,
          {
            baseOptions: { modelAssetPath: modelUrl },
          }
        )

        // Create an audio context to process the audio stream
        const audioCtx = new AudioContext()

        // Resume the audio context if it is in a suspended state
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        // Create a media stream source from the microphone stream
        const source = audioCtx.createMediaStreamSource(stream)

        // Create a ScriptProcessorNode to process audio data in real time
        const scriptNode = audioCtx.createScriptProcessor(16384, 1, 1)

        // Event listener to process audio data when it becomes available
        scriptNode.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0) // Get audio data from the first channel
          const results = classifier.classify(inputData) // Classify the audio data

          if (results?.length > 0) {
            // Extract classification results
            const categories = results[0]?.classifications[0]?.categories

            // Determine if the audio is classified as "Speech" with a confidence above the threshold
            setIsSpeaking(
              categories?.[0]?.categoryName === 'Speech' &&
                parseFloat(categories[0]?.score.toFixed(3)) >
                  confidenceThreshold
                ? 'Yes'
                : 'No'
            )
          }
        }

        // Connect the audio processing nodes
        source.connect(scriptNode)
        scriptNode.connect(audioCtx.destination)
      } catch (error) {
        // Log any errors during initialization
        console.error('Error initializing VoiceActivityDetection:', error)
      }
    }

    // Function to cache the model locally to reduce repeated downloads
    const cacheModel = async (url: string): Promise<string> => {
      const cache = await caches.open(CACHE_NAME) // Open the specified cache
      const cachedResponse = await cache.match(url) // Check if the model is already cached

      if (cachedResponse) {
        console.log('Model loaded from cache:', url)
        return url // Return the cached URL if available
      }

      console.log('Downloading model and caching it...')
      const response = await fetch(url) // Download the model
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`)
      }

      await cache.put(url, response) // Cache the downloaded model
      console.log('Model cached successfully.')
      return url // Return the URL of the cached model
    }

    // Initialize the voice activity detection logic
    initialize()
  }, [filesetResolver]) // Re-run initialization only if the filesetResolver changes

  return (
    <div>
      {/* Display whether the user is speaking */}
      <h4></h4>
    </div>
  )
}

export default VoiceActivityDetection
