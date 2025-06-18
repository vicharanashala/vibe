export type MLProcessor = (image: ImageBitmap) => void;

class CameraProcessor {
  private videoElement: HTMLVideoElement | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private frameRate: number;
  private mlProcessors: MLProcessor[] = [];

  constructor(frameRate = 1) {
    this.frameRate = frameRate;
  }

  async initialize(videoElement: HTMLVideoElement) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Webcam not supported");
    }

    this.videoElement = videoElement;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { frameRate: { max: 30 } } });
    this.videoElement.srcObject = stream;

    await new Promise((resolve) => (this.videoElement!.onloadedmetadata = () => resolve(null)));
  }

  startCapturing() {
    if (!this.videoElement) {
      throw new Error("Video element not initialized");
    }

    this.intervalId = setInterval(async () => {
      const frame = await this.captureFrame();
      if (frame) {
        this.mlProcessors.forEach((processor) => processor(frame));
      }
    }, 1000 / this.frameRate);
  }

  stopCapturing() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async captureFrame(): Promise<ImageBitmap | null> {
    if (!this.videoElement) return null;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = this.videoElement.videoWidth || 640;
    canvas.height = this.videoElement.videoHeight || 480;
    ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

    return createImageBitmap(canvas);
  }

  addMLProcessor(processor: MLProcessor) {
    this.mlProcessors.push(processor);
  }
}

export default CameraProcessor;
