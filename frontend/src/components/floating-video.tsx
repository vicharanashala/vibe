import React, { useRef, useEffect, useState } from 'react';

interface FloatingVideoProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export const FloatingVideo: React.FC<FloatingVideoProps> = ({ 
  isVisible = true, 
  onClose 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 320, height: 280 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [overlayPosition, setOverlayPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-left');

  // Mock anomaly data - replace with real data from your detection system
  const [anomalyData] = useState({
    blur: false,
    speaking: false,
    gesture: 'None',
    focus: false,
    faceCount: 0,
    penaltyScore: 112
  });

  // Face detection function
  const detectFacePosition = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Use smaller resolution for faster processing
    const scale = 0.3; // Slightly higher resolution for better detection
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Create skin mask
    const skinMask = new Uint8Array(width * height);
    
    // Enhanced skin detection with adaptive thresholds
    const isSkinColor = (r: number, g: number, b: number): boolean => {
      // Multiple optimized rules
      
      // Rule 1: More relaxed RGB bounds for various skin tones
      const rule1 = r > 50 && g > 30 && b > 15 && 
                   r > b && g > b && 
                   Math.abs(r - g) <= 50 &&
                   (r + g + b) > 100;

      // Rule 2: YCbCr color space (most reliable for skin detection)
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b;
      
      const rule2 = y > 70 && cb >= 80 && cb <= 140 && cr >= 130 && cr <= 185;

      // Rule 3: Normalized RGB ratios
      const sum = r + g + b;
      const rule3 = sum > 0 && 
                   (r / sum) > 0.30 && (r / sum) < 0.60 &&
                   (g / sum) > 0.22 && (g / sum) < 0.48 &&
                   (b / sum) > 0.12 && (b / sum) < 0.38;

      return rule1 && (rule2 || rule3);
    };

    // Apply skin detection
    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      skinMask[pixelIndex] = isSkinColor(r, g, b) ? 255 : 0;
    }

    // Morphological operations for noise reduction
    const morphologyKernel = 2; // Smaller kernel for more sensitivity
    const cleanedMask = new Uint8Array(width * height);
    
    // Opening operation (erosion followed by dilation)
    for (let y = morphologyKernel; y < height - morphologyKernel; y++) {
      for (let x = morphologyKernel; x < width - morphologyKernel; x++) {
        const idx = y * width + x;
        let minVal = 255;
        
        // Erosion
        for (let ky = -morphologyKernel; ky <= morphologyKernel; ky++) {
          for (let kx = -morphologyKernel; kx <= morphologyKernel; kx++) {
            const kidx = (y + ky) * width + (x + kx);
            minVal = Math.min(minVal, skinMask[kidx]);
          }
        }
        cleanedMask[idx] = minVal;
      }
    }

    // Count skin pixels in each quadrant with smaller clusters for more sensitivity
    const faceRegions = {
      topLeft: 0,
      topRight: 0,
      bottomLeft: 0,
      bottomRight: 0
    };

    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const clusterSize = 4; // Smaller cluster size for higher sensitivity

    for (let y = 0; y < height; y += clusterSize) {
      for (let x = 0; x < width; x += clusterSize) {
        let clusterSkin = 0;
        
        // Count skin pixels in cluster
        for (let cy = 0; cy < clusterSize && y + cy < height; cy++) {
          for (let cx = 0; cx < clusterSize && x + cx < width; cx++) {
            const idx = (y + cy) * width + (x + cx);
            if (cleanedMask[idx] > 0) clusterSkin++;
          }
        }
        
        // Lower threshold for more sensitive detection
        if (clusterSkin > clusterSize * clusterSize * 0.2) {
          const centerX = x + clusterSize / 2;
          const centerY = y + clusterSize / 2;
          
          if (centerX < halfWidth && centerY < halfHeight) faceRegions.topLeft += clusterSkin;
          else if (centerX >= halfWidth && centerY < halfHeight) faceRegions.topRight += clusterSkin;
          else if (centerX < halfWidth && centerY >= halfHeight) faceRegions.bottomLeft += clusterSkin;
          else faceRegions.bottomRight += clusterSkin;
        }
      }
    }

    // Find dominant face region
    const maxRegion = Object.keys(faceRegions).reduce((a, b) => 
      faceRegions[a as keyof typeof faceRegions] > faceRegions[b as keyof typeof faceRegions] ? a : b
    ) as keyof typeof faceRegions;

    const positionMap = {
      topLeft: 'bottom-right' as const,
      topRight: 'bottom-left' as const,
      bottomLeft: 'top-right' as const,
      bottomRight: 'top-left' as const
    };

    const maxPixels = faceRegions[maxRegion];
    const totalSkinPixels = Object.values(faceRegions).reduce((sum, count) => sum + count, 0);
    
    // More sensitive threshold logic
    const confidence = totalSkinPixels > 0 ? maxPixels / totalSkinPixels : 0;
    
    // Lower thresholds for higher sensitivity
    if (totalSkinPixels > 50 && confidence > 0.3 && maxPixels > 25) {
      setOverlayPosition(positionMap[maxRegion]);
    }
  };

  useEffect(() => {
    if (!isVisible) return;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            // Faster detection interval for more responsiveness
            const interval = setInterval(detectFacePosition, 1000);
            return () => clearInterval(interval);
          };
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
      }
    };

    startWebcam();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isVisible]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      e.preventDefault();
      setIsResizing(true);
      return;
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    } else if (isResizing) {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const newWidth = Math.max(200, e.clientX - rect.left);
        // Maintain 4:3 aspect ratio for video + header
        const aspectRatio = 4 / 3;
        const videoHeight = (newWidth / aspectRatio);
        const newHeight = Math.max(150, videoHeight + 40); // Add header height
        setSize({ width: newWidth, height: newHeight });
      }
    }
  };

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
  }, [isDragging, isResizing, dragOffset]);

  if (!isVisible) return null;

  const videoHeight = size.height -30; // Subtract header height

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
        return `${baseClasses} top-0 left-0`;
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-black rounded-lg shadow-lg border border-gray-600 overflow-hidden select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="bg-red-600 text-white px-3 py-1 flex justify-between items-center text-sm">
        <span className="font-medium">🚨 Detected Anomalies!</span>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-white hover:bg-red-700 rounded px-2 py-0.5"
          >
            ×
          </button>
        )}
      </div>

      {/* Video Container */}
      <div className="relative" style={{ height: `${videoHeight}px` }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover bg-gray-800"
          style={{ transform: 'scaleX(-1)' }}
        />
        
        {/* Hidden canvas for face detection */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        {/* Overlay */}
        <div className={getOverlayClasses()} style={{background:"rgba(0, 0, 0, 0.5)"}}>
          <div className="space-y-1">
            <div className="font-semibold text-yellow-300 mb-1 drop-shadow-lg">Results</div>
            
            <div className="space-y-0.5 text-[9px] drop-shadow-md">
              <div>Blur: <span className={anomalyData.blur ? 'text-red-400' : 'text-green-400'}>
                {anomalyData.blur ? 'Yes' : 'No'}
              </span></div>
              
              <div>Speaking: <span className={anomalyData.speaking ? 'text-red-400' : 'text-green-400'}>
                {anomalyData.speaking ? 'Yes' : 'No'}
              </span></div>
              
              <div>Gesture: <span className="text-gray-300">
                {anomalyData.gesture}
              </span></div>
              
              <div>Focus: <span className={anomalyData.focus ? 'text-green-400' : 'text-red-400'}>
                {anomalyData.focus ? 'Focused' : 'Not Focused'}
              </span></div>
              
              <div>Faces: <span className="text-gray-300">
                {anomalyData.faceCount}
              </span></div>
              
              <div>Score: <span className="text-red-400 font-medium">
                {anomalyData.penaltyScore}
              </span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-600 opacity-60 hover:opacity-100"
        style={{ 
          clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)',
          pointerEvents: 'auto'
        }}
      />
    </div>
  );
};

export default FloatingVideo;
