import { useEffect, useRef, useState } from "react";
import { MousePointer2 } from "lucide-react";

/**
 * When the cursor leaves the page for >= 5s, blur the page and tell the parent
 * (which pauses the video). As soon as the cursor returns, it reports `false`
 * so the parent can auto-resume. Scoped to the cursor leaving the page (not tab
 * blur) — tab visibility is handled by the player itself.
 */
export function AwayOverlay({
  onAwayChange,
  delayMs = 5000,
}: {
  onAwayChange: (away: boolean) => void;
  delayMs?: number;
}) {
  const [away, setAway] = useState(false);
  const awayRef = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onLeave = (e: MouseEvent) => {
      // Only when the cursor truly leaves the window (not entering a child element).
      if (e.relatedTarget || (e as unknown as { toElement?: unknown }).toElement) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        awayRef.current = true;
        setAway(true);
        onAwayChange(true);
      }, delayMs);
    };
    const onEnter = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (awayRef.current) {
        awayRef.current = false;
        setAway(false);
        onAwayChange(false); // returning from an away state → resume
      }
    };

    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
    };
  }, [onAwayChange, delayMs]);

  if (!away) return null;

  return (
    <div className="fixed inset-0 z-110 grid place-items-center bg-stage/70 backdrop-blur-xl animate-vibe-fade-in">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-5 text-card-foreground shadow-2xl animate-vibe-slide-up">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-warm/15 text-warm">
          <MousePointer2 className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold">Paused — come back to focus</h3>
        <p className="text-sm text-muted-foreground">Move your cursor back into the lesson to resume.</p>
      </div>
    </div>
  );
}

export default AwayOverlay;
