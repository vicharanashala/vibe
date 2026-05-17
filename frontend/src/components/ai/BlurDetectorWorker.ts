/*self.onmessage = (event) => {
    const imageData = event.data;
    if (!imageData) return;
  */

self.onmessage = (event) => {
  const { frame, mask, flick } = event.data;
  if (!frame || !mask) return;

  const { data, width, height } = frame;
    function rgbToGrayscale(frame:ImageData): Uint8ClampedArray {
      const gray = new Uint8ClampedArray(frame.width * frame.height);
      for (let i = 0; i < gray.length; i++) {
        const r = frame.data[i * 4];
        const g = frame.data[i * 4 + 1];
        const b = frame.data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
      return gray;
    }
  //laplacian--> detects blur
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
  //variance for laplacian--> if low variance, image is blurry
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
  //Edge density using sobel operator--> if low edge density, image is blurry
  function computeEdgeDensity(
    gray: Uint8ClampedArray,
    width: number,
    height: number
  ): number {
    let edges = 0;

    const sobelX = [
      -1, 0, 1,
      -2, 0, 2,
      -1, 0, 1,
    ];

    const sobelY = [
      -1, -2, -1,
       0,  0,  0,
       1,  2,  1,
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = gray[(y + ky) * width + (x + kx)];
            const idx = (ky + 1) * 3 + (kx + 1);

            gx += pixel * sobelX[idx];
            gy += pixel * sobelY[idx];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);

        if (magnitude > 100) edges++;
      }
    }

    return edges / (width * height);
  }

  //background variance
  /*let bgValues = [];

  for (let i = 0; i < data.length; i += 4) {
    const isBackground = mask.data[i] < 128;

    if (isBackground) {
      const grayPixel =
        0.299 * data[i] +
        0.587 * data[i + 1] +
        0.114 * data[i + 2];

      bgValues.push(grayPixel);
    }
  }

  let bgVariance = 0;

  if (bgValues.length > 0) {
    const meanBg =
      bgValues.reduce((a, b) => a + b, 0) / bgValues.length;

    bgVariance =
      bgValues.reduce((sum, v) => sum + (v - meanBg) ** 2, 0) /
      bgValues.length;
  }*/
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const isBackground = mask.data[i] < 128;
    if (isBackground) {
      const grayPixel =0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += grayPixel;
      sumSq += grayPixel * grayPixel;
      count++;
    }
  }
  let bgVariance = 0;
  if (count > 0) {
    const mean = sum / count;
    bgVariance = sumSq / count - mean * mean;
  }//direct math, no storing in array, less memory

    // **Perform Blur Check**
    //const scale = 0.5;
    //const width = Math.floor(frame.width * scale);
    //const height = Math.floor(frame.height * scale);
    const gray = rgbToGrayscale(frame);
    const laplacian = computeLaplacian(gray, width, height);
    const variance = computeVariance(laplacian);
    //const isBlurry = variance < 250;
    const edgeDensity = computeEdgeDensity(gray, width, height);

  // Combine metrics (simple heuristic)
  const safeFlick = flick ?? 0;
  const blurScore = variance < 140 ? 1 : 0;
  const edgeScore = edgeDensity < 0.07 ? 1 : 0;
  const bgScore = bgVariance < 60 ? 1 : 0;
  const flickScore = safeFlick > 25 ? 1 : 0;

  const score =
    0.4 * blurScore +
    0.3 * edgeScore +
    0.2 * bgScore +
    0.1 * flickScore;

    self.postMessage({
    score,
    variance,
    edgeDensity,
    bgVariance,
    flick: safeFlick,
  });
  };
  