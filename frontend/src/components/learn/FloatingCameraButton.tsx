import { Camera } from "lucide-react";
import { LearnWebcamPreview } from "./LearnWebcamPreview";

type Props = {
  /** Whether the preview is currently shown (pinned OR hover-peek). */
  open: boolean;
  /** Whether the preview is pinned on by a click (drives the button's on/off look). */
  pinned: boolean;
  /** Toggle the pinned preview (parent also pauses the video). */
  onToggle: () => void;
  /** Hover-to-peek the preview without changing the pinned state. */
  onHoverChange: (hovering: boolean) => void;
  /** True while a proctoring anomaly is active (renders the preview in alert state). */
  anomaly?: boolean;
};

/**
 * Middle-left floating control. Click pins/unpins a live webcam preview (and
 * pauses the video); hover peeks it. The button shows a clear on/off state so
 * the pin status is obvious even while the cursor is still on it.
 */
export function FloatingCameraButton({ open, pinned, onToggle, onHoverChange, anomaly }: Props) {
  return (
    <div
      className="absolute left-4 top-1/2 z-50 -translate-y-1/2 sm:left-6"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <button
        onClick={onToggle}
        aria-label={pinned ? "Hide camera preview" : "Show camera preview"}
        aria-pressed={pinned}
        className={`grid h-9 w-9 place-items-center rounded-full bg-glass text-stage-foreground shadow-lg ring-1 ring-glass-border backdrop-blur-md transition hover:scale-105 hover:opacity-100 ${
          pinned ? "opacity-100" : "opacity-60"
        }`}
      >
        <Camera className="h-4 w-4" />
      </button>

      <div
        className={`absolute left-full top-1/2 ml-3 -translate-y-1/2 transition-all duration-200 ${
          open
            ? "pointer-events-auto opacity-100 translate-x-0"
            : "pointer-events-none opacity-0 -translate-x-2"
        }`}
      >
        <LearnWebcamPreview size="sm" anomaly={anomaly} />
      </div>
    </div>
  );
}

export default FloatingCameraButton;
