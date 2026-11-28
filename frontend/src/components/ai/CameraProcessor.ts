import { MLProcessor } from "@/types/ai.types";
import {registerStream, unRegisterStream} from "@/lib/MediaRegistry";
import { runProctoringChecks } from "@/utils/proctoring/proctoringGuard";

class CameraProcessor {
  private videoElement: HTMLVideoElement | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private frameRate: number;
  private mlProcessors: MLProcessor[] = [];
  private includeAudio: boolean;

  // includeAudio is opt-in: the course-page flow passes it so this one
  // session-long stream can also back voice detection and evidence-audio
  // capture elsewhere (via MediaRegistry's "CameraProcessor-stream" key)
  // instead of each of them opening its own separate concurrent
  // getUserMedia call. Leave it false for standalone callers (e.g. the exam
  // flow's own CameraProcessor instance) so they keep requesting only the
  // camera permission they actually need, unchanged.
  constructor(frameRate = 1, includeAudio = false) {
    this.frameRate = frameRate;
    this.includeAudio = includeAudio;
  }

  async initialize(videoElement: HTMLVideoElement) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Webcam not supported");
    }

    this.videoElement = videoElement;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { frameRate: { max: 30 } },
      ...(this.includeAudio ? { audio: true } : {}),
    });
    // Safety check: prevent ML pipeline from processing virtual camera stream
    const violations = await runProctoringChecks(stream);

    if (violations.length > 0) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error(violations[0].reason);
    }

    unRegisterStream("CameraProcessor-stream");
    registerStream("CameraProcessor-stream", stream);
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