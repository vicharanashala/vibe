import { useEffect, useState } from "react";
import { AudioLines } from "lucide-react";

/**
 * Top-center, non-blocking indicator shown when the proctor detects speaking or
 * background noise (the `voiceDetection` anomaly). Briefly held after the noise
 * stops so it doesn't flicker. Does not pause the video.
 */
export function NoiseIndicator({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (active) {
      setShow(true);
      return;
    }
    const t = setTimeout(() => setShow(false), 1200);
    return () => clearTimeout(t);
  }, [active]);

  if (!show) return null;

  return (
    <div className="fixed left-1/2 top-4 z-95 -translate-x-1/2 animate-vibe-slide-up">
      <div className="flex items-center gap-2.5 rounded-full bg-glass px-4 py-2 text-stage-foreground shadow-lg ring-1 ring-glass-border backdrop-blur-md">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-warm/20 text-warm">
          <AudioLines className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-medium">Background noise detected — please keep quiet</span>
        <span className="flex h-3.5 items-end gap-0.5" aria-hidden>
          <span className="w-0.5 rounded-full bg-warm animate-vibe-bar1" />
          <span className="w-0.5 rounded-full bg-warm animate-vibe-bar2" />
          <span className="w-0.5 rounded-full bg-warm animate-vibe-bar3" />
        </span>
      </div>
    </div>
  );
}

export default NoiseIndicator;
