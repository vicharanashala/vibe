import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
}

export const ImageWithFallback = ({ 
  src, 
  alt, 
  className, 
  aspectRatio = "aspect-video" 
}: ImageWithFallbackProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    if (imageRef.current) {
      // Apply placeholder styling
      imageRef.current.src = "https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6";
      imageRef.current.classList.add("image-placeholder");
    }
  };

  // If image is already cached, we need to handle that case
  useEffect(() => {
    if (imageRef.current?.complete) {
      handleLoad();
    }
  }, []);

  return (
    <div className={`relative overflow-hidden ${aspectRatio} bg-muted ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center image-loading">
          <ImageIcon className="h-12 w-12 text-muted-foreground opacity-30" />
        </div>
      )}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'image-fade-in'} ${hasError ? 'image-placeholder' : ''}`}
      />
    </div>
  );
};
