import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Face } from '@tensorflow-models/face-detection';
import * as faceapi from '@vladmandic/face-api';

export interface FaceRecognition {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  distance: number;
  isMatch: boolean;
}

export interface TrackedFace {
  id: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  distance: number;
  isMatch: boolean;
  lastSeen: number;
  trackingFrames: number;
  confidence: number;
}

export interface FaceRecognitionDebugInfo {
  knownFacesCount: number;
  knownFaceLabels: string[];
  detectedPhotoFaces: number;
  currentFrameFaces: number;
  recognizedFaces: number;
  trackedFaces: number;
  reusedTracks: number;
  newRecognitions: number;
  processingTime?: number;
  lastUpdateTime: number;
  backendStatus: 'loading' | 'success' | 'error';
  errorMessage?: string;
}

interface FaceRecognitionComponentProps {
  faces: Face[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onRecognitionResult?: (recognitions: FaceRecognition[]) => void;
  onDebugInfoUpdate?: (debugInfo: FaceRecognitionDebugInfo) => void;
}

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

// Optimized IOU calculation with early termination
function calculateIOU(box1: { x: number; y: number; width: number; height: number }, 
                     box2: { x: number; y: number; width: number; height: number }): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }

  const intersectionArea = (x2 - x1) * (y2 - y1);
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - intersectionArea;

  return intersectionArea / unionArea;
}

// Use crypto API for better performance than Math.random
function generateFaceId(): string {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);
  return array.join('');
}

const FaceRecognitionComponent: React.FC<FaceRecognitionComponentProps> = ({
  faces,
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
    trackedFaces: 0,
    reusedTracks: 0,
    newRecognitions: 0,
    lastUpdateTime: Date.now(),
    backendStatus: 'loading'
  });
  const [recognitions, setRecognitions] = useState<FaceRecognition[]>([]);
  const [trackedFaces, setTrackedFaces] = useState<TrackedFace[]>([]);
  const lastProcessTime = useRef<number>(0);
  const processingInterval = 500; // Process every 1 second for faster testing
  const labeledDescriptorsRef = useRef<faceapi.LabeledFaceDescriptors[]>([]);
  
  // IOU tracking configuration
  const IOU_THRESHOLD = 0.5; // Minimum IOU to consider faces as the same
  const TRACK_EXPIRY_TIME = 3000; // Remove tracks after 3 seconds of not being seen

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
        // console.log('[FaceRecognitionComponent] Initializing face-api models...');
        updateDebugInfo({ backendStatus: 'loading' });
        
        const modelUrl = '/models/face-api/model';
        
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl)
        ]);
        
        // console.log('[FaceRecognitionComponent] Face-api models loaded successfully');
        
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
        // console.log('[FaceRecognitionComponent] Loading known faces from API...');
        const response = await fetch(`${import.meta.env.VITE_BASE_URL}/activity/known-faces`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        // console.log('[FaceRecognitionComponent] Fetched known faces data:', data);

        const peopleData = data.faces || [];
        
        if (!Array.isArray(peopleData)) {
          console.error('[FaceRecognitionComponent] API response is not an array:', peopleData);
          updateDebugInfo({ backendStatus: 'error', errorMessage: 'Invalid API response format' });
          return;
        }

        // console.log(`[FaceRecognitionComponent] Processing ${peopleData.length} people...`);

        const labeledDescriptors = await Promise.all(
          peopleData.map(async (person, personIndex) => {
            // console.log(`[FaceRecognitionComponent] Processing person ${personIndex + 1}/${peopleData.length}: ${person.label}`);
            const descriptions: Float32Array[] = [];
            const validImageUrls = person.imagePaths.filter(isValidImageUrl);

            // console.log(`[FaceRecognitionComponent] Person ${person.label} has ${validImageUrls.length} valid images`);

            if (validImageUrls.length === 0) {
              // console.warn(`[FaceRecognitionComponent] No valid images for: ${person.label}`);
              return null;
            }

            for (const [imgIndex, imgUrl] of validImageUrls.entries()) {
              try {
                // console.log(`[FaceRecognitionComponent] Processing image ${imgIndex + 1}/${validImageUrls.length} for ${person.label}: ${imgUrl}`);
                
                // Use faceapi.fetchImage properly
                const img = await faceapi.fetchImage(imgUrl);
                // console.log(`[FaceRecognitionComponent] Image loaded successfully for ${person.label}`);
                
                const detectionResult = await faceapi
                  .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                  .withFaceLandmarks()
                  .withFaceDescriptor();

                if (detectionResult && detectionResult.descriptor) {
                  descriptions.push(detectionResult.descriptor);
                  // console.log(`[FaceRecognitionComponent] ✅ Successfully processed face from: ${person.label} (${imgIndex + 1}/${validImageUrls.length})`);
                } else {
                  // console.warn(`[FaceRecognitionComponent] ❌ No face detected in: ${imgUrl}`);
                }
              } catch (imgError: unknown) {
                console.error(`[FaceRecognitionComponent] Error processing ${imgUrl}:`, imgError);
                // Try alternative approach if CORS fails
                const errorMessage = imgError instanceof Error ? imgError.message : String(imgError);
                if (errorMessage.includes('CORS') || errorMessage.includes('fetch')) {
                  // console.log(`[FaceRecognitionComponent] Trying alternative loading method for: ${imgUrl}`);
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
                      // console.log(`[FaceRecognitionComponent] ✅ Successfully processed face (alternative method) from: ${person.label}`);
                    }
                  } catch (altError: unknown) {
                    console.error(`[FaceRecognitionComponent] Alternative method also failed for ${imgUrl}:`, altError);
                  }
                }
              }
            }

            // console.log(`[FaceRecognitionComponent] Person ${person.label}: ${descriptions.length} face descriptors created`);

            return descriptions.length > 0 
              ? new faceapi.LabeledFaceDescriptors(person.label, descriptions)
              : null;
          })
        );

        const validDescriptors = labeledDescriptors.filter((desc): desc is faceapi.LabeledFaceDescriptors => 
          desc !== null && desc.descriptors.length > 0
        );
        
        labeledDescriptorsRef.current = validDescriptors;
        
        const labels = validDescriptors.map(desc => desc.label);
        const totalPhotoFaces = validDescriptors.reduce((sum, desc) => sum + desc.descriptors.length, 0);
        
        // console.log(`[FaceRecognitionComponent] Loaded ${validDescriptors.length} people with ${totalPhotoFaces} face descriptors`);
        
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

  // Process face recognition when faces are detected
  const processRecognition = useCallback(async () => {
    // console.log('[FaceRecognitionComponent] processRecognition called', {
    //   isReady,
    //   hasVideo: !!videoRef.current,
    //   facesLength: faces.length,
    //   labeledDescriptorsLength: labeledDescriptorsRef.current.length
    // });

    if (!isReady || !videoRef.current || faces.length === 0 || labeledDescriptorsRef.current.length === 0) {
      // console.log('[FaceRecognitionComponent] Skipping recognition - conditions not met');
      return;
    }

    const now = Date.now();
    if (now - lastProcessTime.current < processingInterval) {
      // console.log('[FaceRecognitionComponent] Skipping recognition - too soon');
      return;
    }

    // console.log('[FaceRecognitionComponent] Processing recognition...');
    const startTime = performance.now();

    try {
      const video = videoRef.current;
      
      // Check video dimensions
      // console.log('[FaceRecognitionComponent] Video dimensions:', {
      //   videoWidth: video.videoWidth,
      //   videoHeight: video.videoHeight,
      //   readyState: video.readyState
      // });

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        // console.warn('[FaceRecognitionComponent] Video dimensions are zero, skipping');
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

      // console.log('[FaceRecognitionComponent] Canvas created, detecting faces...');

      const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      // console.log('[FaceRecognitionComponent] Face detections:', detections.length);

      if (detections.length === 0) {
        const processingTime = performance.now() - startTime;
        // console.log('[FaceRecognitionComponent] No faces detected in frame');
        
        // Clean up expired tracks (only recognized faces should be in tracking anyway)
        setTrackedFaces(prev => prev.filter(track => track.isMatch && now - track.lastSeen < TRACK_EXPIRY_TIME));
        
        updateDebugInfo({
          currentFrameFaces: faces.length,
          recognizedFaces: 0,
          trackedFaces: 0,
          reusedTracks: 0,
          newRecognitions: 0,
          processingTime
        });
        setRecognitions([]);
        onRecognitionResult?.([]);
        lastProcessTime.current = now;
        return;
      }

      // Convert detections to bounding boxes
      const currentDetections = detections.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height
        },
        descriptor: detection.descriptor
      }));

      // Match current detections with existing tracked faces using IOU
      // Only match with tracked faces that were previously recognized (not unknown)
      const matchedTracks: { trackIndex: number; detectionIndex: number; iou: number }[] = [];
      const usedDetections = new Set<number>();
      const usedTracks = new Set<number>();

      // Find best matches between current detections and tracked faces (only recognized ones)
      for (let detIndex = 0; detIndex < currentDetections.length; detIndex++) {
        let bestMatch = { trackIndex: -1, iou: 0 };
        
        for (let trackIndex = 0; trackIndex < trackedFaces.length; trackIndex++) {
          if (usedTracks.has(trackIndex)) continue;
          
          // Only match with previously recognized faces (skip unknown faces)
          const track = trackedFaces[trackIndex];
          if (!track.isMatch) continue;
          
          const iou = calculateIOU(currentDetections[detIndex].box, track.box);
          if (iou > IOU_THRESHOLD && iou > bestMatch.iou) {
            bestMatch = { trackIndex, iou };
          }
        }
        
        if (bestMatch.trackIndex !== -1) {
          matchedTracks.push({
            trackIndex: bestMatch.trackIndex,
            detectionIndex: detIndex,
            iou: bestMatch.iou
          });
          usedDetections.add(detIndex);
          usedTracks.add(bestMatch.trackIndex);
        }
      }

      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptorsRef.current, 0.6);
      const newRecognitions: FaceRecognition[] = [];
      const updatedTracks: TrackedFace[] = [];
      let newRecognitionCount = 0;
      let reusedTrackCount = 0;

      // Process matched tracks (reuse existing recognition results)
      for (const match of matchedTracks) {
        const track = trackedFaces[match.trackIndex];
        const detection = currentDetections[match.detectionIndex];
        
        // Update track with new position
        const updatedTrack: TrackedFace = {
          ...track,
          box: detection.box,
          lastSeen: now,
          trackingFrames: track.trackingFrames + 1,
          confidence: Math.min(track.confidence + 0.1, 1.0) // Increase confidence over time
        };
        
        updatedTracks.push(updatedTrack);
        newRecognitions.push({
          box: detection.box,
          label: track.label,
          distance: track.distance,
          isMatch: track.isMatch
        });
        
        reusedTrackCount++;
        // console.log(`[FaceRecognitionComponent] Reused track for ${track.label} (IOU: ${match.iou.toFixed(3)})`);
      }

      // Process unmatched detections (perform new recognition)
      for (let detIndex = 0; detIndex < currentDetections.length; detIndex++) {
        if (usedDetections.has(detIndex)) continue;
        
        const detection = currentDetections[detIndex];
        const match = faceMatcher.findBestMatch(detection.descriptor);
        const isMatch = match.label !== 'unknown' && match.distance < 0.6;
        
        // Create new track
        const newTrack: TrackedFace = {
          id: generateFaceId(),
          box: detection.box,
          label: isMatch ? match.label : 'unknown',
          distance: match.distance,
          isMatch,
          lastSeen: now,
          trackingFrames: 1,
          confidence: 0.5
        };
        
        // Only add to tracked faces if it's a recognized face
        if (isMatch) {
          updatedTracks.push(newTrack);
        }
        
        newRecognitions.push({
          box: detection.box,
          label: newTrack.label,
          distance: newTrack.distance,
          isMatch: newTrack.isMatch
        });
        
        newRecognitionCount++;
        // console.log(`[FaceRecognitionComponent] New recognition: ${match.label}, distance: ${match.distance.toFixed(3)}, isMatch: ${isMatch}${isMatch ? ' (added
      }

      // Add unexpired recognized tracks that weren't matched (faces that disappeared this frame)
      for (let trackIndex = 0; trackIndex < trackedFaces.length; trackIndex++) {
        if (usedTracks.has(trackIndex)) continue;
        
        const track = trackedFaces[trackIndex];
        // Only keep recognized faces in tracking and within expiry time
        if (track.isMatch && now - track.lastSeen < TRACK_EXPIRY_TIME) {
          updatedTracks.push(track); // Keep track but don't add to current recognitions
        }
      }

      // Update state
      setTrackedFaces(updatedTracks);

      const processingTime = performance.now() - startTime;
      const recognizedCount = newRecognitions.filter(r => r.isMatch).length;

      console.log(`[FaceRecognitionComponent] Processing complete - Recognized: ${recognizedCount}, Reused: ${reusedTrackCount}, New: ${newRecognitionCount}, Tracked faces: ${updatedTracks.length} in ${processingTime.toFixed(2)}ms`);

      updateDebugInfo({
        currentFrameFaces: faces.length,
        recognizedFaces: recognizedCount,
        trackedFaces: updatedTracks.length,
        reusedTracks: reusedTrackCount,
        newRecognitions: newRecognitionCount,
        processingTime
      });
      
      setRecognitions(newRecognitions);
      onRecognitionResult?.(newRecognitions);
      lastProcessTime.current = now;

    } catch (error) {
      console.error('[FaceRecognitionComponent] Error processing recognition:', error);
      const processingTime = performance.now() - startTime;
      updateDebugInfo({
        processingTime,
        errorMessage: `Recognition failed: ${error}`
      });
    }
  }, [isReady, faces, videoRef, onRecognitionResult, updateDebugInfo, trackedFaces]);

  // Trigger recognition when faces change
  useEffect(() => {
    if (faces.length > 0) {
      processRecognition();
    }
  }, [faces, processRecognition]);

  // Cleanup tracked faces on unmount
  useEffect(() => {
    return () => {
      setTrackedFaces([]);
    };
  }, []);

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
            Tracking: {debugInfo.trackedFaces} recognized faces | 
            Reused: {debugInfo.reusedTracks} | 
            New: {debugInfo.newRecognitions}
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
