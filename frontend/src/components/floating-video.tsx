import React, { useRef, useEffect, useState, useCallback, JSX, use } from 'react';
import ReactDOM from 'react-dom';
import { ChevronUp, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GestureDetector from './ai/GestureDetector';
import BlurDetection from './ai/BlurDetector';
import SpeechDetector from './ai/SpeechDetector';
import FaceDetectors from './ai/FaceDetectors';
import FaceRecognitionOverlay from './ai/FaceRecognitionOverlay';
import { FaceRecognition, FaceRecognitionDebugInfo } from './ai/FaceRecognitionComponent';
// import FaceRecognitionIntegrated from '../ai-components/FaceRecognitionIntegrated';
import useCameraProcessor from './ai/useCameraProcessor';
import { useReportAnomaly } from '@/hooks/hooks';

import { useAuthStore } from '@/store/auth-store';
import { useCourseStore } from '@/store/course-store';

// Proctoring settings interface based on the backend structure
interface IDetectorSettings {
  detectorName: string;
  settings: {
    enabled: boolean;
  };
}

interface ProctoringSettings {
  _id: string;
  studentId: string;
  versionId: string;
  courseId: string;
  settings: {
    proctors: {
      detectors: IDetectorSettings[];
    };
  };
}

interface FloatingVideoProps {
  isVisible?: boolean;
  onClose?: () => void;
  onAnomalyDetected?: (hasAnomaly: boolean) => void;
  setDoGesture: (value: boolean) => void;
  settings?: ProctoringSettings;
}

let flag = 0;
function FloatingVideo({
  isVisible = true,
  onClose,
  onAnomalyDetected,
  setDoGesture,
  settings
}: FloatingVideoProps): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 320, height: 280 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [overlayPosition, setOverlayPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPoppedOut, setIsPoppedOut] = useState(true);
  const [anomaly, setAnomaly] = useState(false);


  // Original aspect ratio (maintain the initial component ratio)
  const ORIGINAL_ASPECT_RATIO = 320 / 280; // width / height from initial size

  // AI Detection States
  const [isBlur, setIsBlur] = useState("No");
  const [isSpeaking, setIsSpeaking] = useState("No");
  const [gesture, setGesture] = useState("No Gesture Detected ❌");
  const [isFocused, setIsFocused] = useState(false);
  const [facesCount, setFacesCount] = useState(0);
  const [recognizedFaces, setRecognizedFaces] = useState<FaceRecognition[]>([]);
  const [faceRecognitionDebug, setFaceRecognitionDebug] = useState<FaceRecognitionDebugInfo>({
    knownFacesCount: 0,
    knownFaceLabels: [],
    detectedPhotoFaces: 0,
    currentFrameFaces: 0,
    recognizedFaces: 0,
    lastUpdateTime: Date.now(),
    backendStatus: 'loading'

  });
  const [penaltyPoints, setPenaltyPoints] = useState(-10);
  const [penaltyType, setPenaltyType] = useState("");

  // Thumbs-up challenge states
  const [isThumbsUpChallenge, setIsThumbsUpChallenge] = useState(false);
  const [thumbsUpCountdown, setThumbsUpCountdown] = useState(0);
  const [lastChallengeTime, setLastChallengeTime] = useState(0);
  // Get our videoRef and face data from the custom hook
  const { videoRef, modelReady, faces } = useCameraProcessor(1);

  // Helper function to check if a specific proctoring component is enabled
  const isComponentEnabled = useCallback((componentName: string): boolean => {
    if (!settings?.settings?.proctors?.detectors) return false;
    
    const detector = settings.settings.proctors.detectors.find(
      (detector) => detector.detectorName === componentName
    );
    
    return detector?.settings?.enabled ?? false;
  }, [settings]);

  // Check which components are enabled
  const isBlurDetectionEnabled = isComponentEnabled('blurDetection');
  const isFaceCountDetectionEnabled = isComponentEnabled('faceCountDetection');
  const isHandGestureDetectionEnabled = isComponentEnabled('handGestureDetection');
  const isVoiceDetectionEnabled = isComponentEnabled('voiceDetection');
  const isFaceRecognitionEnabled = isComponentEnabled('faceRecognition');
  const isFocusEnabled = isComponentEnabled('focus');

  // Log enabled components for debugging
  useEffect(() => {
    if (settings) {
      console.log('🔧 [FloatingVideo] Proctoring settings loaded:', {
        blurDetection: isBlurDetectionEnabled,
        faceCountDetection: isFaceCountDetectionEnabled,
        handGestureDetection: isHandGestureDetectionEnabled,
        voiceDetection: isVoiceDetectionEnabled,
        faceRecognition: isFaceRecognitionEnabled,
        focus: isFocusEnabled
      });
    }
  }, [settings, isBlurDetectionEnabled, isFaceCountDetectionEnabled, isHandGestureDetectionEnabled, isVoiceDetectionEnabled, isFaceRecognitionEnabled, isFocusEnabled]);

  // Add the hooks
  const { data, error, mutate: reportAnomaly } = useReportAnomaly();
  const authStore = useAuthStore();
  const courseStore = useCourseStore();
  // Handle face recognition results
  const handleFaceRecognitionResult = useCallback((recognitions: FaceRecognition[]) => {
    console.log('🎯 [FloatingVideo] Face recognition callback triggered with recognitions:', recognitions);
    setRecognizedFaces(recognitions);

    // Log additional info about the recognition
    const knownFaces = recognitions.filter(r => r.isMatch);
    if (knownFaces.length > 0) {
      console.log('✅ [FloatingVideo] Known faces detected:', knownFaces.map(f => f.label).join(', '));
    } else {
      console.log('❓ [FloatingVideo] No known faces recognized');
    }
  }, []);

  // Handle face recognition debug info updates
  const handleFaceRecognitionDebugUpdate = useCallback((debugInfo: FaceRecognitionDebugInfo) => {
    console.log('🔍 [FloatingVideo] Face recognition debug update:', debugInfo);
    setFaceRecognitionDebug(debugInfo);
  }, []);

  // Store current media stream
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [faceDetectorsKey, setFaceDetectorsKey] = useState(0);
  const [aiComponentsKey, setAiComponentsKey] = useState(0);
  if (flag === 0) {
    setFaceDetectorsKey(prev => prev + 1);
    flag++;
  }
  // Effect to handle isPoppedOut changes - reset everything
  useEffect(() => {
    console.log('[FloatingVideo] isPoppedOut changed to:', isPoppedOut);
    // Small delay to ensure DOM is ready, then restart video
    setTimeout(() => {
      restartVideo();
    }, 100);
  }, [isPoppedOut]);
  useEffect(() => {
    if (anomaly) {
      reportAnomaly({
        body: {
          userId: authStore.user?.userId || "",
          courseId: courseStore.currentCourse?.courseId || "",
          courseVersionId: courseStore.currentCourse?.versionId || "",
          moduleId: courseStore.currentCourse?.moduleId || "",
          sectionId: courseStore.currentCourse?.sectionId || "",
          itemId: courseStore.currentCourse?.itemId || "",
          anomalyType: anomalyType
        }
      });
    }
  }, [anomaly]);

  // Function to restart video stream
  const restartVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    console.log('[FloatingVideo] Restarting video stream...');

    try {
      // Stop current stream if exists
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      // Reset all AI components by incrementing their keys
      setAiComponentsKey(prev => prev + 1);
      setFaceDetectorsKey(prev => prev + 1);

      // Get new stream with standard configuration
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          frameRate: { max: 30 },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      video.srcObject = stream;
      setCurrentStream(stream);

      // Setup and play video with timeout protection
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Video load timeout')), 100);

        const onSuccess = () => {
          clearTimeout(timeoutId);
          console.log('[FloatingVideo] Video stream restarted successfully');
          setTimeout(() => {
            console.log('[FloatingVideo] AI components reinitialized');
            resolve(null);
          }, 100);
        };

        video.onloadedmetadata = () => video.play().then(onSuccess).catch(reject);
        video.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error('Video load error'));
        };
      });
    } catch (error) {
      console.error('[FloatingVideo] Error restarting video:', error);
    }
  }, [videoRef, currentStream]);

  // Update face count when faces change
  useEffect(() => {
    if (!modelReady) return;
    setFacesCount(faces.length);
  }, [faces, modelReady]);

  // Update penalty score every second when anomalies are detected
  useEffect(() => {
    const interval = setInterval(() => {
      let newPenaltyPoints = 0;
      let newPenaltyType = "";

      // Condition 1: If speaking is detected (only if voice detection is enabled)
      if (isSpeaking === "Yes" && isVoiceDetectionEnabled) {
        newPenaltyType = "Speaking";
        newPenaltyPoints += 1;
      }

      // Condition 2: If faces count is not exactly 1 (only if face count detection is enabled)
      if (facesCount !== 1 && isFaceCountDetectionEnabled) {
        newPenaltyType = "Faces Count";
        newPenaltyPoints += 1;
      }

      // Condition 3: If the screen is blurred (only if blur detection is enabled)
      if (isBlur === "Yes" && isBlurDetectionEnabled) {
        newPenaltyType = "Blur";
        newPenaltyPoints += 1;
      }

      // Condition 4: If not focused (only if focus tracking is enabled)
      if (!isFocused && isFocusEnabled) {
        newPenaltyType = "Focus";
        newPenaltyPoints += 1;
      }

      // If there are any new penalty points, increment the cumulative score
      if (newPenaltyPoints > 0) {
        setPenaltyPoints((prevPoints) => prevPoints + newPenaltyPoints);
        setPenaltyType(newPenaltyType);

        const anomalyType = newPenaltyType === "Focus" ? "focus": newPenaltyType === "Blur" ? "blurDetection" : newPenaltyType === "Faces Count" ? "faceCountDetection" : newPenaltyType === "Speaking" ? "voiceDetection" : newPenaltyType === "Pre-emptive Thumbs-Up" ? "handGestureDetection" : newPenaltyType === "Failed Thumbs-Up Challenge" ? "handGestureDetection" :  "faceRecognition";
        // here to add the hook

        console.log({body: {
            userId: authStore.user?.userId || "", 
            courseId: courseStore.currentCourse?.courseId || "", 
            courseVersionId: courseStore.currentCourse?.versionId || "",
            moduleId: courseStore.currentCourse?.moduleId || "",
            sectionId: courseStore.currentCourse?.sectionId || "",
            itemId: courseStore.currentCourse?.itemId || "",
            anomalyType: anomalyType
        }});
        reportAnomaly({
          body: {
            userId: authStore.user?.userId || "", 
            courseId: courseStore.currentCourse?.courseId || "", 
            courseVersionId: courseStore.currentCourse?.versionId || "",
            moduleId: courseStore.currentCourse?.moduleId || "",
            sectionId: courseStore.currentCourse?.sectionId || "",
            itemId: courseStore.currentCourse?.itemId || "",
            anomalyType: anomalyType
        }})
        console.log(data, error)
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [
    isSpeaking, 
    facesCount, 
    isBlur, 
    isFocused, 
    reportAnomaly, 
    authStore.user?.userId, 
    courseStore.currentCourse,
    isVoiceDetectionEnabled,
    isFaceCountDetectionEnabled,
    isBlurDetectionEnabled,
    isFocusEnabled,
    data,
    error
  ]);
  const mul = 7; // For testing purposes, set to 1 for 3 seconds, change to 60 for real-time (2-5 minutes)
  // Random thumbs-up challenge system - only run if gesture detection is enabled
  useEffect(() => {
    if (!isHandGestureDetectionEnabled) return;
    
    const checkForChallenge = () => {
      const now = Date.now();
      const timeSinceLastChallenge = now - lastChallengeTime;

      // Only trigger if no active challenge and enough time has passed (2-5 minutes randomly)
      if (!isThumbsUpChallenge && timeSinceLastChallenge > 3000 * mul) { // Minimum 30 seconds for testing
        const randomInterval = Math.random() * (3000 * mul - 1200 * mul) + 1200 * mul; // 2-5 minutes

        if (timeSinceLastChallenge > randomInterval) {
          // Check if user is already showing thumbs-up when challenge starts
          const gestureText = gesture.toLowerCase();
          const isAlreadyThumbsUp = gestureText.includes("thumb_up") || gestureText === "thumb_up";

          if (isAlreadyThumbsUp) {
            console.log("[Challenge] ⚠️ Thumbs-up detected when challenge starts - marking as anomaly");
            // Add penalty for pre-emptive thumbs-up
            setPenaltyPoints(prevPoints => prevPoints + 1);
            setPenaltyType("Pre-emptive Thumbs-Up");
            setLastChallengeTime(now); // Update time to prevent immediate next challenge
          } else {
            // Show alert without blocking execution
            setDoGesture(true);
            console.log("[Challenge] 🎯 Starting new thumbs-up challenge");
            setIsThumbsUpChallenge(true);
            setThumbsUpCountdown(5);
            setLastChallengeTime(now);
          }
        }
      }
    };

    const interval = setInterval(checkForChallenge, 1000);
    return () => clearInterval(interval);
  }, [isThumbsUpChallenge, lastChallengeTime, gesture, isHandGestureDetectionEnabled, setDoGesture]);

  // Thumbs-up countdown timer - only run if gesture detection is enabled
  useEffect(() => {
    if (!isHandGestureDetectionEnabled || !isThumbsUpChallenge || thumbsUpCountdown <= 0) return;

    const timer = setTimeout(() => {
      setThumbsUpCountdown(prev => {
        if (prev <= 1) {
          // Time's up - add penalty and end challenge
          setPenaltyPoints(prevPoints => prevPoints + 2);
          setPenaltyType("Failed Thumbs-Up Challenge");
          setDoGesture(false);
          setIsThumbsUpChallenge(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [isThumbsUpChallenge, thumbsUpCountdown, isHandGestureDetectionEnabled, setDoGesture]);

  // Check for thumbs-up gesture during challenge - only run if gesture detection is enabled
  useEffect(() => {
    if (!isHandGestureDetectionEnabled || !isThumbsUpChallenge || !gesture) return;
    
    const gestureText = gesture.toLowerCase();
    console.log(`[Challenge] Current gesture detected: "${gesture}" (normalized: "${gestureText}")`);
    
    // Check for various thumbs-up patterns that MediaPipe might return
    const isThumbsUp = gestureText.includes("thumb_up") || gestureText === "thumb_up";
    
    if (isThumbsUp) {
      console.log("[Challenge] ✅ Thumbs-up detected! Challenge passed.");
      setDoGesture(false);
      // Success - end challenge without penalty
      setIsThumbsUpChallenge(false);
      setThumbsUpCountdown(0);
    }
  }, [gesture, isThumbsUpChallenge, isHandGestureDetectionEnabled, setDoGesture]);

  // Check if any anomalies are detected - only consider enabled detectors
  const isAnomaliesDetected = (isSpeaking === "Yes" && isVoiceDetectionEnabled) || 
                              (facesCount !== 1 && isFaceCountDetectionEnabled) || 
                              (isBlur === "Yes" && isBlurDetectionEnabled) || 
                              (!isFocused && isFocusEnabled) ||
                              (isThumbsUpChallenge && isHandGestureDetectionEnabled);


  // Smart overlay positioning based on face detection
  useEffect(() => {
    if (!faces.length || !faces[0]) return;

    const face = faces[0];
    if (!face.box) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) return;

    // Calculate face position relative to video (0-1 scale)
    const faceX = (face.box.xMin + face.box.width / 2) / videoWidth;
    const faceY = (face.box.yMin + face.box.height / 2) / videoHeight;

    // Position overlay opposite to face position
    if (faceX >= 0.5 && faceY < 0.5) {
      setOverlayPosition('bottom-left');
    } else if (faceX < 0.5 && faceY < 0.5) {
      setOverlayPosition('bottom-right');
    } else if (faceX >= 0.5 && faceY >= 0.5) {
      setOverlayPosition('top-left');
    } else {
      setOverlayPosition('top-right');
    }
  }, [faces, videoRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on resize handle first
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) {
      e.preventDefault();
      setIsResizing(true);
      return;
    }

    // Ignore clicks on buttons
    if (target.closest('button')) {
      return;
    }

    // Start dragging
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      requestAnimationFrame(() => {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      });
    } else if (isResizing) {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        requestAnimationFrame(() => {
          const newWidth = Math.max(200, e.clientX - rect.left);
          // Maintain original aspect ratio
          const newHeight = Math.max(150, newWidth / ORIGINAL_ASPECT_RATIO);
          setSize({ width: newWidth, height: newHeight });
        });
      }
    }
  }, [isDragging, isResizing, dragOffset, ORIGINAL_ASPECT_RATIO]);

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection during drag/resize
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [isDragging, isResizing, handleMouseMove]);

  // Enhanced video lifecycle management
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      console.log('[FloatingVideo] Video ended, restarting...');
      video.currentTime = 0;
      video.play().catch(() => { });
    };

    const handlePause = () => {
      console.log('[FloatingVideo] Video paused, attempting to resume...');
      // If not intentionally paused (muted, hidden, etc.), try to play
      if (video.paused && !video.ended) {
        video.play().catch(() => { });
      }
    };

    const handleError = () => {
      console.log('[FloatingVideo] Video error, restarting stream...');
      restartVideo();
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [videoRef, restartVideo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentStream]);

  if (!isVisible) return null;

  const videoHeight = size.height - 30; // Always maintain video height for AI detection
  const containerHeight = isCollapsed ? 34 : size.height; // Just header height when collapsed

  const getOverlayClasses = () => {
    const baseClasses = "absolute text-white p-2 text-xs pointer-events-none max-w-[50%] backdrop-blur-sm transition-all duration-500";

    switch (overlayPosition) {
      case 'top-left':
        return `${baseClasses} top-0 left-0`;
      case 'top-right':
        return `${baseClasses} top-0 right-0`;
      case 'bottom-left':
        return `${baseClasses} bottom-0 left-0`;
      case 'bottom-right':
        return `${baseClasses} bottom-0 right-0`;
      default:
        return `${baseClasses} top-0 right-0`;
    }
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsCollapsed(!isCollapsed);
  };

  const floatingVideoContent = (
    <div
      ref={containerRef}
      className={`z-[999999] bg-black rounded-lg shadow-lg border border-gray-600 overflow-hidden select-none transition-all duration-300 ${isPoppedOut
        ? 'fixed'
        : 'relative'
        }`}
      style={isPoppedOut ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${containerHeight}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      } : isCollapsed ? {
        height: '34px',
        width: '100%',
      } : {
        height: `${size.height}px`
      }}
      onMouseDown={isPoppedOut ? handleMouseDown : undefined}
    >
      {/* Header - Anomaly state */}
      {isAnomaliesDetected && (
        <div className="bg-red-600 text-white px-3 py-1 flex justify-between items-center text-sm min-h-[34px]">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <span className="font-medium truncate">
              {isThumbsUpChallenge
                ? `👍 Show Thumbs Up: ${thumbsUpCountdown}s`
                : `🚨 ${isCollapsed ? `${penaltyType || 'Anomalies'} (${penaltyPoints})` : 'Detected Anomalies!'}`
              }
            </span>
          </div>
          <div className="flex items-center space-x-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="h-6 w-6 p-0 text-white hover:bg-red-700 hover:text-white flex-shrink-0"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsPoppedOut(!isPoppedOut);
              }}
              className="h-6 w-6 p-0 text-white hover:bg-current hover:text-white flex-shrink-0"
            >
              {isPoppedOut ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      )}

      {/* Header - Normal state */}
      {!isAnomaliesDetected && (
        <div className="bg-green-600 text-white px-3 py-1 flex justify-between items-center text-sm">
          <div className="flex items-center space-x-2 flex-1">
            <span className="font-medium">✅ {isCollapsed ? `All Clear (${penaltyPoints})` : 'All Clear'}</span>
            {/* Face Recognition Status */}
            {!isCollapsed && recognizedFaces.length > 0 && (
              <span className="text-xs opacity-90">
                | Recognized: {recognizedFaces.filter(f => f.isMatch).map(f => f.label).join(', ') || 'Unknown'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="h-6 w-6 p-0 text-white hover:bg-green-700 hover:text-white"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsPoppedOut(!isPoppedOut);
              }}
              className="h-6 w-6 p-0 text-white hover:bg-current hover:text-white"
            >
              {isPoppedOut ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      )}

      {/* Video element - Always present and functional for AI detection */}
      <div
        className="absolute top-8 left-0"
        style={{
          width: isCollapsed ? '1px' : '100%',
          height: isCollapsed ? '1px' : `${videoHeight}px`,
          overflow: 'hidden'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover bg-gray-800"
          style={{
            transform: 'scaleX(-1)',
            // Always keep video visible to AI components
            opacity: 1,
          }}
        />

        {/* Enhanced Face Recognition Debug Overlay */}
        {/* {!isCollapsed && (
          <div className="absolute top-0 left-0 z-20 bg-black bg-opacity-75 text-white p-3 text-xs font-mono border-r border-b border-gray-600">
          <div className="space-y-1">
            {/* Backend Status */}
        {/* <div className="flex items-center gap-2">
            <span className="text-gray-300">Backend:</span>
            <span className={`font-semibold ${
              faceRecognitionDebug.backendStatus === 'success' ? 'text-green-400' : 
              faceRecognitionDebug.backendStatus === 'error' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {faceRecognitionDebug.backendStatus.toUpperCase()}
            </span>
            </div>
            
            {/* Known Faces Info */}
        {/* <div className="text-blue-300">
            Known People: {faceRecognitionDebug.knownFacesCount}
            </div>
            
            {/* Photo Faces Info */}
        {/* <div className="text-purple-300">
            Photo Faces: {faceRecognitionDebug.detectedPhotoFaces}
            </div>
            
            {/* Current Frame Info */}
        {/* <div className="text-cyan-300">
            Frame Faces: {faceRecognitionDebug.currentFrameFaces}
            </div>
            
            {/* Recognition Results */}
        {/* <div className="text-green-300">
            Recognized: {faceRecognitionDebug.recognizedFaces}
            </div>
            
            {/* Processing Time */}
        {/* {faceRecognitionDebug.processingTime && (
            <div className="text-orange-300">
              Process: {faceRecognitionDebug.processingTime.toFixed(1)}ms
            </div>
            )}
            
            {/* Known Face Labels */}
        {/* {faceRecognitionDebug.knownFaceLabels.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-gray-300 mb-1">Known:</div>
              <div className="text-yellow-300 text-xs">
              {faceRecognitionDebug.knownFaceLabels.join(', ')}
              </div>
            </div>
            )}
            
            {/* Current Recognition Results */}
        {/* {recognizedFaces.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-gray-300 mb-1">Current:</div>
              {recognizedFaces.map((face, idx) => (
              <div key={idx} className={`text-xs ${face.isMatch ? 'text-green-300' : 'text-red-300'}`}>
                {face.label} ({face.distance.toFixed(3)})
              </div>
              ))}
            </div>
            )}
            
            {/* Error Message */}
        {/* {faceRecognitionDebug.errorMessage && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-red-400 text-xs">Error: {faceRecognitionDebug.errorMessage}</div>
            </div>
            )}
            
            {/* Last Update Time */}
        {/* <div className="mt-2 pt-2 border-t border-gray-600 text-gray-400 text-xs">
            Updated: {new Date(faceRecognitionDebug.lastUpdateTime).toLocaleTimeString()}
            </div>
          </div>
          </div>
        )} */}
        {/* )} */}
        {!isCollapsed && recognizedFaces.length > 0 && (
          <FaceRecognitionOverlay
            recognitions={recognizedFaces}
            videoRef={videoRef}
            className="z-10"
          />
        )}

        {/* Canvas for face detection - Always present */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />

        {/* Face Recognition Overlay
        {modelReady && (
          <>
            {console.log('🔍 [FloatingVideo] Rendering FaceRecognitionIntegrated with:', {
              facesCount: faces.length,
              hasVideo: !!videoRef.current,
              modelReady
            })}
            <FaceRecognitionIntegrated
              faces={faces}
              videoElement={videoRef.current}
              modelReady={modelReady}
              onRecognitionResult={handleFaceRecognitionResult}
            />
          </>
        )} */}

        {/* Overlay and UI elements - Only show when not collapsed */}
        {!isCollapsed && (
          <>
            {/* Overlay - Only show when anomalies are detected */}
            {isAnomaliesDetected && (
              <div className={getOverlayClasses()} style={{ background: "rgba(0, 0, 0, 0.7)", pointerEvents: 'none' }}>
                <div className="space-y-1">
                  <div className="font-semibold text-yellow-300 mb-1 drop-shadow-lg">
                    {isThumbsUpChallenge ? "Security Challenge" : "Anomaly Details"}
                  </div>

                  <div className="space-y-0.5 text-[9px] drop-shadow-md">
                    {isThumbsUpChallenge && (
                      <div className="text-yellow-300 font-medium">
                        👍 Show Thumbs Up: <span className="text-red-400">
                          {thumbsUpCountdown}s
                        </span>
                      </div>
                    )}

                    {!isThumbsUpChallenge && (
                      <>
                        {isBlur === "Yes" && (
                          <div>Blur: <span className="text-red-400">
                            {isBlur}
                          </span></div>
                        )}

                        {isSpeaking === "Yes" && (
                          <div>Speaking: <span className="text-red-400">
                            {isSpeaking}
                          </span></div>
                        )}

                        {!isFocused && (
                          <div>Focus: <span className="text-red-400">
                            Not Focused
                          </span></div>
                        )}

                        {facesCount !== 1 && (
                          <div>Faces: <span className="text-red-400">
                            {facesCount} {facesCount === 0 ? "(None detected)" : facesCount > 1 ? "(Multiple detected)" : ""}
                          </span></div>
                        )}

                        {/* Face Recognition Results */}
                        {recognizedFaces.length > 0 && (
                          <div>Recognized:
                            {recognizedFaces.map((face, index) => (
                              <span key={index} className={face.isMatch ? "text-green-400" : "text-yellow-400"}>
                                {index > 0 ? ", " : " "}
                                {face.isMatch ? face.label : "Unknown"}
                                {face.isMatch && ` (${Math.round((1 - face.distance) * 100)}%)`}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    <div className="border-t border-gray-500 pt-1 mt-2">
                      <div>Penalty Score: <span className="text-red-400 font-medium">
                        {penaltyPoints}
                      </span></div>
                      {penaltyType && (
                        <div>Last Issue: <span className="text-orange-300">
                          {penaltyType}
                        </span></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Score display in corner when no anomalies */}
            {!isAnomaliesDetected && penaltyPoints > 0 && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs pointer-events-none">
                Score: {penaltyPoints}
              </div>
            )}
          </>
        )}
      </div>

      {/* AI Components - Only render if enabled in proctoring settings */}
      <div className="hidden">
        {isBlurDetectionEnabled && (
          <BlurDetection 
            key={`blur-${aiComponentsKey}`}
            videoRef={videoRef} 
            setIsBlur={setIsBlur}
          />
        )}
        {isVoiceDetectionEnabled && (
          <SpeechDetector 
            key={`speech-${aiComponentsKey}`}
            setIsSpeaking={setIsSpeaking}
          />
        )}
        {isHandGestureDetectionEnabled && (
          <GestureDetector 
            key={`gesture-${aiComponentsKey}`}
            videoRef={videoRef} 
            setGesture={setGesture}
            trigger={true}
          />
        )}
        {(isFaceCountDetectionEnabled || isFaceRecognitionEnabled || isFocusEnabled) && (
          <FaceDetectors 
            key={`face-${faceDetectorsKey}`}
            faces={faces} 
            setIsFocused={setIsFocused}
            videoRef={videoRef}
            onRecognitionResult={handleFaceRecognitionResult}
            onDebugInfoUpdate={handleFaceRecognitionDebugUpdate}
            settings={isFaceCountDetectionEnabled, isFaceRecognitionEnabled, isFocusEnabled}
          />
        )}
      </div>

      {/* Resize Handle - Only show when not collapsed and popped out */}
      {!isCollapsed && isPoppedOut && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-600 opacity-60 hover:opacity-100"
          style={{
            clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)',
            pointerEvents: 'auto'
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
          }}
        />
      )}
    </div>
  );

  // Use portal to render floating video at the end of body if popped out
  if (isPoppedOut && typeof window !== 'undefined') {
    return ReactDOM.createPortal(floatingVideoContent, document.body);
  }
  // Otherwise render in place (sidebar)
  return floatingVideoContent;
};

export default FloatingVideo;