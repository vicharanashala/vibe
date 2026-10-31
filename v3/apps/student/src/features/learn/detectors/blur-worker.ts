/**
 * Laplacian-variance blur check — a sharp image has strong high-frequency
 * edges (high variance after a Laplacian pass); a blurry one doesn't. No ML
 * model, pure pixel math, so it runs cheaply in a worker on every frame.
 */

function toGrayscale(data: ImageData): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(data.width * data.height);
  for (let i = 0; i < gray.length; i++) {
    const r = data.data[i * 4];
    const g = data.data[i * 4 + 1];
    const b = data.data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

function laplacianVariance(gray: Uint8ClampedArray, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const value = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width];
      sum += value;
      sumSq += value * value;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

const BLUR_VARIANCE_THRESHOLD = 250;

self.onmessage = (event: MessageEvent<ImageData>) => {
  const imageData = event.data;
  if (!imageData) return;
  const gray = toGrayscale(imageData);
  const variance = laplacianVariance(gray, imageData.width, imageData.height);
  self.postMessage({ isBlurry: variance < BLUR_VARIANCE_THRESHOLD, variance });
};

export {};
