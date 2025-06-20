self.onmessage = (event) => {
    const imageData = event.data;
    if (!imageData) return;
  
    function rgbToGrayscale(imageData: ImageData): Uint8ClampedArray {
      const gray = new Uint8ClampedArray(imageData.width * imageData.height);
      for (let i = 0; i < gray.length; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
      return gray;
    }
  
    function computeLaplacian(gray: Uint8ClampedArray, width: number, height: number): Float32Array {
      const laplacian = new Float32Array(gray.length);
      const kernel = [
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
  
    // **Perform Blur Check**
    const scale = 0.5;
    const width = Math.floor(imageData.width * scale);
    const height = Math.floor(imageData.height * scale);
    const gray = rgbToGrayscale(imageData);
    const laplacian = computeLaplacian(gray, width, height);
    const variance = computeVariance(laplacian);
    const isBlurry = variance < 250;
  
    self.postMessage({ isBlurry, variance });
  };
  