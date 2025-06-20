import React from 'react';
import { FaceRecognition } from './FaceRecognitionComponentNoWorker';

interface FaceRecognitionOverlayProps {
  recognitions: FaceRecognition[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}

const FaceRecognitionOverlay: React.FC<FaceRecognitionOverlayProps> = ({
  recognitions,
  videoRef,
  className = ''
}) => {
  // Calculate scale factors for overlay positioning
  const getOverlayStyle = () => {
    if (!videoRef.current) return {};

    const video = videoRef.current;
    const videoWidth = video.videoWidth || video.clientWidth;
    const videoHeight = video.videoHeight || video.clientHeight;
    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    return {
      scaleX: displayWidth / videoWidth,
      scaleY: displayHeight / videoHeight,
      videoWidth: displayWidth,
      videoHeight: displayHeight
    };
  };

  const overlayStyle = getOverlayStyle();

  if (recognitions.length === 0 || !overlayStyle.scaleX) {
    return null;
  }

  return (
    <div 
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        width: overlayStyle.videoWidth,
        height: overlayStyle.videoHeight
      }}
    >
      {recognitions.map((recognition, index) => {
        const scaledBox = {
          x: recognition.box.x * overlayStyle.scaleX,
          y: recognition.box.y * overlayStyle.scaleY,
          width: recognition.box.width * overlayStyle.scaleX,
          height: recognition.box.height * overlayStyle.scaleY
        };

        return (
          <div
            key={index}
            className="absolute"
            style={{
              left: `${scaledBox.x}px`,
              top: `${scaledBox.y}px`,
              width: `${scaledBox.width}px`,
              height: `${scaledBox.height}px`
            }}
          >
            {/* Face bounding box */}
            <div 
              className={`absolute inset-0 border-2 rounded ${
                recognition.isMatch 
                  ? 'border-green-400' 
                  : 'border-red-400'
              }`}
            />
            
            {/* Name label */}
            <div 
              className={`absolute -top-8 left-0 px-2 py-1 text-xs font-medium rounded shadow-lg ${
                recognition.isMatch 
                  ? 'bg-green-500 text-white' 
                  : 'bg-red-500 text-white'
              }`}
              style={{ 
                minWidth: 'max-content',
                maxWidth: `${scaledBox.width * 2}px`
              }}
            >
              {recognition.isMatch ? recognition.label : 'Unknown'}
              {recognition.isMatch && (
                <div className="text-xs opacity-90">
                  {Math.round((1 - recognition.distance) * 100)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaceRecognitionOverlay;
