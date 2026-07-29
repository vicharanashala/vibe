import { AlertTriangle } from "lucide-react";
import { LearnWebcamPreview } from "./LearnWebcamPreview";

type Props = {
  /** Active while a proctoring anomaly holds the video paused. */
  active: boolean;
  /** Active anomaly codes from the proctoring engine; used to pick the message. */
  anomalies?: string[];
};

function copyFor(anomalies: string[]): { title: string; message: string } {
  if (anomalies.includes("faceRecognition"))
    return {
      title: "Identity check",
      message:
        "We detected a different or unrecognised face. Please make sure the registered learner is the one on camera — your lesson resumes automatically.",
    };
  if (anomalies.includes("multipleFaces"))
    return {
      title: "Multiple people detected",
      message:
        "More than one person is visible. Please make sure you're alone in frame — your lesson resumes automatically.",
    };
  if (anomalies.includes("noFace") || anomalies.includes("faceCountDetection"))
    return {
      title: "Stay in frame",
      message:
        "We can't see you. Please face the screen and stay in frame — your lesson resumes automatically.",
    };
  if (anomalies.includes("voiceDetection"))
    return {
      title: "Audio detected",
      message: "We detected talking. Please stay quiet during the lesson — it resumes automatically.",
    };
  if (anomalies.includes("blurDetection"))
    return {
      title: "Camera unclear",
      message: "Your camera view is blurry. Please adjust your camera — your lesson resumes automatically.",
    };
  if (anomalies.includes("cameraIntegrity"))
    return {
      title: "Camera issue",
      message:
        "We detected a camera problem. Please use a real, working webcam — your lesson resumes automatically.",
    };
  return {
    title: "Focus check",
    message: "Please face the screen — your lesson resumes automatically once everything looks good.",
  };
}

/**
 * Buttonless, opaque anomaly alert. Fully covers the video (the learner cannot
 * watch until the anomaly clears) and shows their webcam centered so they can
 * correct the issue. Auto-dismisses when `active` goes false (the proctoring
 * engine clears the pause). No interactive controls by design.
 */
export function ProctorAlertOverlay({ active, anomalies = [] }: Props) {
  if (!active) return null;
  const { title, message } = copyFor(anomalies);

  return (
    <div className="fixed inset-0 z-120 grid place-items-center select-none">
      {/* Opaque backdrop hides the video entirely */}
      <div className="absolute inset-0 bg-stage/95 backdrop-blur-md" />
      <div className="absolute inset-0 bg-danger-flash/25 animate-vibe-flash" />
      <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-card p-6 text-card-foreground shadow-2xl animate-vibe-slide-up">
        <div className="mb-4 flex justify-center">
          <LearnWebcamPreview size="md" anomaly />
        </div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-danger-flash/15 text-danger-flash">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-center text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-center text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-danger-flash">
          <span className="h-2 w-2 rounded-full bg-danger-flash animate-vibe-flash" />
          Verifying live via camera…
        </div>
      </div>
    </div>
  );
}

export default ProctorAlertOverlay;
