import { useEffect, useState } from "react";
import { LearnWebcamPreview } from "./LearnWebcamPreview";
import { LearnPrepMessages } from "./LearnPrepMessages";

/**
 * Auto-shows the webcam preview centered for the first ~11 seconds after mount
 * (while the camera is setting up / on reload), then fades away. Can be hidden
 * early. Render only when proctoring is enabled.
 */
export function InitialWebcamPopup({ seconds = 15 }: { seconds?: number }) {
  const [visible, setVisible] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(seconds);

  useEffect(() => {
    if (!visible) return;
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          setVisible(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-55 grid place-items-center bg-stage/85 backdrop-blur-md animate-vibe-fade-in">
      <div className="flex flex-col items-center gap-4 animate-vibe-slide-up">
        <LearnWebcamPreview size="md" caption="setting up" />

        {/* Premium, mentor-toned guidance while the session initializes */}
        <LearnPrepMessages />

        <button
          onClick={() => setVisible(false)}
          className="rounded-full bg-glass px-3 py-1 text-[11px] text-stage-foreground backdrop-blur-md ring-1 ring-glass-border transition hover:bg-foreground/10"
        >
          Hide preview · {secondsLeft}s
        </button>
      </div>
    </div>
  );
}

export default InitialWebcamPopup;
