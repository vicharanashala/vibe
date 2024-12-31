import React, { useEffect, useRef, useState } from "react";

// take isBlur as props
interface BlurDetectionProps {
    isBlur: string;
    setIsBlur: (value: string) => void;
}

const BlurDetection: React.FC<BlurDetectionProps> = ({ isBlur, setIsBlur }) => {

    const videoRef = useRef<HTMLVideoElement>(null);
    const [image, setImage] = useState<ImageData | null>(null);

    useEffect(() => {
        const startWebcam = async () => {
            const video = videoRef.current;
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (video) {
                    video.srcObject = stream;
                    video.play();
                }
            }
        };

        startWebcam();

        return () => {
            const video = videoRef.current;
            if (video && video.srcObject) {
                const tracks = (video.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
      const captureFrame = () => {
        const video = videoRef.current;
        if (video) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            if(ctx){
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              setImage(imageData)
            }
      }
    };
    

        const interval = setInterval(captureFrame, 200);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      if(! image){
        return;
      }
      checkBlur(image);
    }, [image]);

    function checkBlur(imageData: ImageData): void {
      // Downscale the image for performance
      const scale: number = 0.5; // Scale down to 50% of the original size
      const width: number = Math.floor(imageData.width * scale);
      const height: number = Math.floor(imageData.height * scale);

      // Convert to grayscale
      const gray: Uint8ClampedArray = rgbToGrayscale(imageData);

      // Compute the Laplacian
      const laplacian: Float32Array = computeLaplacian(gray, width, height);

      // Compute the variance
      const variance: number = computeVariance(laplacian);

      // Threshold for blurriness (adjust as needed)
      const isBlurry: boolean = variance < 250;

      if (isBlurry) {
        setIsBlur("Yes");
      } else {
        setIsBlur("No");
      }
      return;
    }
  
      /**
       * Converts RGB image data to grayscale.
       * @param {ImageData} imageData - The image data to convert.
       * @returns {Uint8ClampedArray} - Grayscale pixel data.
       */

      function rgbToGrayscale(imageData: ImageData): Uint8ClampedArray {
        const gray = new Uint8ClampedArray(imageData.width * imageData.height);
        for (let i = 0; i < gray.length; i++) {
          const r = imageData.data[i * 4];
          const g = imageData.data[i * 4 + 1];
          const b = imageData.data[i * 4 + 2];
          // Grayscale conversion formula
          gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }
        return gray;
      }
  
      /**
       * Computes the Laplacian of the grayscale image.
       * @param {Uint8ClampedArray} gray - Grayscale pixel data.
       * @param {number} width - Image width.
       * @param {number} height - Image height.
       * @returns {Float32Array} - Laplacian pixel data.
       */
      interface LaplacianKernel {
        [index: number]: number[];
      }

      function computeLaplacian(gray: Uint8ClampedArray, width: number, height: number): Float32Array {
        const laplacian = new Float32Array(gray.length);
        const kernel: LaplacianKernel = [
          [0, 1, 0],
          [1, -4, 1],
          [0, 1, 0],
        ];
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const pixel = gray[(y + ky) * width + (x + kx)];
                const weight = kernel[ky + 1][kx + 1];
                sum += pixel * weight;
              }
            }
            laplacian[y * width + x] = sum;
          }
        }
        return laplacian;
      }
  
      /**
       * Computes the variance of pixel data.
       * @param {Float32Array} data - Pixel data.
       * @returns {number} - Variance of the data.
       */
      function computeVariance(data: Float32Array): number {
        let mean = 0;
        for (let i = 0; i < data.length; i++) {
          mean += data[i];
        }
        mean /= data.length;

        let variance = 0;
        for (let i = 0; i < data.length; i++) {
          variance += Math.pow(data[i] - mean, 2);
        }
        variance /= data.length;

        return variance;
      }

    

    return (
        <div>
            <video ref={videoRef} style={{ display: "block" }} />
            <h4>Blur: {isBlur}</h4>
        </div>
    );


}


export default BlurDetection;