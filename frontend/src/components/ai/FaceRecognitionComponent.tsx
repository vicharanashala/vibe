import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';

import type { FaceRecognition, TrackedFace, FaceRecognitionDebugInfo, FaceRecognitionComponentProps } from '@/types/ai.types';

// Optimized validation with caching
const URL_VALIDATION_CACHE = new Map<string, boolean>();

function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Check cache first
  if (URL_VALIDATION_CACHE.has(url)) {
    return URL_VALIDATION_CACHE.get(url)!;
  }
  
  try {
    new URL(url);
  } catch {
    URL_VALIDATION_CACHE.set(url, false);
    return false;
  }
  
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const isDataUrl = url.startsWith('data:image/');
  const hasValidExtension = validExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
  const isValid = isDataUrl || hasValidExtension;
  URL_VALIDATION_CACHE.set(url, isValid);
  return isValid;
}

const FaceRecognitionComponent: React.FC<FaceRecognitionComponentProps> = ({
  videoRef,
  onRecognitionResult,
  onDebugInfoUpdate
}) => {
  const [isReady, setIsReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<FaceRecognitionDebugInfo>({
    knownFacesCount: 0,
    knownFaceLabels: [],
    detectedPhotoFaces: 0,
    currentFrameFaces: 0,
    recognizedFaces: 0,
    lastUpdateTime: Date.now(),
    backendStatus: 'loading',
    trackedFaces: 0,
    reusedTracks: 0,
    newRecognitions: 0
  });
  const [recognitions, setRecognitions] = useState<FaceRecognition[]>([]);
  const lastProcessTime = useRef<number>(0);
  const processingInterval = 100; // Process every 10 seconds
  const labeledDescriptorsRef = useRef<faceapi.LabeledFaceDescriptors[]>([]);
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);

  // Update debug info and notify parent
  const updateDebugInfo = useCallback((updates: Partial<FaceRecognitionDebugInfo>) => {
    setDebugInfo(prev => {
      const newDebugInfo = {
        ...prev,
        ...updates,
        lastUpdateTime: Date.now()
      };
      onDebugInfoUpdate?.(newDebugInfo);
      return newDebugInfo;
    });
  }, [onDebugInfoUpdate]);

  // Initialize face-api models
  useEffect(() => {
    let isMounted = true;

    const initializeModels = async () => {
      try {
        updateDebugInfo({ backendStatus: 'loading' });
        
        const modelUrl = '/models/face-api/model';
        
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl)
        ]);
        
        if (isMounted) {
          await loadKnownFaces();
        }
      } catch (error) {
        console.error('[FaceRecognitionComponent] Error loading face-api models:', error);
        if (isMounted) {
          updateDebugInfo({
            backendStatus: 'error',
            errorMessage: `Failed to load models: ${error}`
          });
        }
      }
    };

    const loadKnownFaces = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BASE_URL}/activity/known-faces`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const peopleData = data.faces || [];
        
        if (!Array.isArray(peopleData)) {
          console.error('[FaceRecognitionComponent] API response is not an array:', peopleData);
          updateDebugInfo({ backendStatus: 'error', errorMessage: 'Invalid API response format' });
          return;
        }

        const labeledDescriptors = await Promise.all(
          peopleData.map(async (person) => {
            const descriptions: Float32Array[] = [];
            const validImageUrls = person.imagePaths.filter(isValidImageUrl);

            if (validImageUrls.length === 0) {
              return null;
            }

            for (const imgUrl of validImageUrls) {
              try {
                const img = await faceapi.fetchImage(imgUrl);
                
                const detectionResult = await faceapi
                  .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                  .withFaceLandmarks()
                  .withFaceDescriptor();

                if (detectionResult && detectionResult.descriptor) {
                  descriptions.push(detectionResult.descriptor);
                }
              } catch (imgError: unknown) {
                console.error(`[FaceRecognitionComponent] Error processing ${imgUrl}:`, imgError);
                const errorMessage = imgError instanceof Error ? imgError.message : String(imgError);
                if (errorMessage.includes('CORS') || errorMessage.includes('fetch')) {
                  try {
                    const imgElement = new Image();
                    imgElement.crossOrigin = 'anonymous';
                    
                    await new Promise((resolve, reject) => {
                      imgElement.onload = resolve;
                      imgElement.onerror = reject;
                      imgElement.src = imgUrl;
                    });
                    
                    const detectionResult = await faceapi
                      .detectSingleFace(imgElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                      .withFaceLandmarks()
                      .withFaceDescriptor();

                    if (detectionResult && detectionResult.descriptor) {
                      descriptions.push(detectionResult.descriptor);
                    }
                  } catch (altError: unknown) {
                    console.error(`[FaceRecognitionComponent] Alternative method also failed for ${imgUrl}:`, altError);
                  }
                }
              }
            }

            return descriptions.length > 0 
              ? new faceapi.LabeledFaceDescriptors(person.label, descriptions)
              : null;
          })
        );

        const validDescriptors = labeledDescriptors.filter((desc): desc is faceapi.LabeledFaceDescriptors => 
          desc !== null && desc.descriptors.length > 0
        );
        
        labeledDescriptorsRef.current = validDescriptors;
        faceMatcherRef.current = new faceapi.FaceMatcher(validDescriptors, 0.6);
        
        const labels = validDescriptors.map(desc => desc.label);
        const totalPhotoFaces = validDescriptors.reduce((sum, desc) => sum + desc.descriptors.length, 0);
        
        if (isMounted) {
          updateDebugInfo({
            knownFacesCount: validDescriptors.length,
            knownFaceLabels: labels,
            detectedPhotoFaces: totalPhotoFaces,
            backendStatus: 'success'
          });
          setIsReady(true);
        }
      } catch (error) {
        console.error('[FaceRecognitionComponent] Error loading known faces:', error);
        if (isMounted) {
          updateDebugInfo({
            backendStatus: 'error',
            errorMessage: `Failed to load known faces: ${error}`
          });
        }
      }
    };

    initializeModels();

    return () => {
      isMounted = false;
    };
  }, [updateDebugInfo]);

  const processRecognition = useCallback(async () => {
    if (!isReady || !videoRef.current || !faceMatcherRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastProcessTime.current < processingInterval) {
      return;
    }
    lastProcessTime.current = now;

    const startTime = performance.now();

    try {
      const video = videoRef.current;
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('[FaceRecognitionComponent] No canvas context');
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        const processingTime = performance.now() - startTime;
        
        updateDebugInfo({
          currentFrameFaces: 0,
          recognizedFaces: 0,
          processingTime
        });
        setRecognitions([]);
        onRecognitionResult?.([]);
        return;
      }

      const faceMatcher = faceMatcherRef.current;
      if (!faceMatcher) return;

      const newRecognitions: FaceRecognition[] = [];

      for (const detection of detections) {
        const match = faceMatcher.findBestMatch(detection.descriptor);
        const isMatch = match.label !== 'unknown' && match.distance < 0.6;
        
        newRecognitions.push({
          box: detection.detection.box,
          label: isMatch ? match.label : 'unknown',
          distance: match.distance,
          isMatch: isMatch
        });
      }

      const processingTime = performance.now() - startTime;
      const recognizedCount = newRecognitions.filter(r => r.isMatch).length;

      updateDebugInfo({
        currentFrameFaces: detections.length,
        recognizedFaces: recognizedCount,
        processingTime
      });
      
      setRecognitions(newRecognitions);
      onRecognitionResult?.(newRecognitions);

    } catch (error) {
      console.error('[FaceRecognitionComponent] Error processing recognition:', error);
      const processingTime = performance.now() - startTime;
      updateDebugInfo({
        processingTime,
        errorMessage: `Recognition failed: ${error}`
      });
    }
  }, [isReady, videoRef, onRecognitionResult, updateDebugInfo]);

  // Main recognition loop with 10-second interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isReady) {
      intervalId = setInterval(() => {
        processRecognition();
      }, processingInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isReady, processRecognition]);

  // Return overlay component
  return (
    <div className="face-recognition-status">
      {!isReady && (
        <div className="text-sm text-yellow-600 mb-2">
          Loading face recognition models...
        </div>
      )}

      {isReady && (
        <div className="text-sm text-green-600 mb-2">
          Ready! {debugInfo.knownFacesCount} known faces loaded
          <div className="text-xs text-gray-600 mt-1">
            Current faces: {debugInfo.currentFrameFaces} | 
            Recognized: {debugInfo.recognizedFaces}
          </div>
        </div>
      )}

      {recognitions.length > 0 && (
        <div className="space-y-1">
          {recognitions.map((recognition, index) => (
            <div 
              key={index}
              className={`text-sm p-2 rounded ${
                recognition.isMatch 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <div className="font-semibold">
                {recognition.isMatch ? recognition.label : 'Unknown Person'}
              </div>
              {recognition.isMatch && (
                <div className="text-xs opacity-75">
                  Confidence: {(1 - recognition.distance).toFixed(2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FaceRecognitionComponent;
