import { useEffect, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck, VideoOff } from "lucide-react";
import { getStream } from "@/lib/MediaRegistry";

type Props = {
  size?: "sm" | "md";
  /** When true, render in the "alert" state (red ring + face-not-detected copy). */
  anomaly?: boolean;
  /** Footer label, e.g. "proctoring". */
  caption?: string;
};

// Stream keys, in priority order. The proctoring engine publishes the analysed
// feed as "CameraProcessor-stream"; the course page registers its own grabs as
// fallbacks. We only DISPLAY here — detection stays owned by <FloatingVideo/>.
const STREAM_KEYS = [
  "CameraProcessor-stream",
  "course-page-stream",
  "course-page-retrystream",
];

/**
 * A clean, display-only webcam preview that reuses the already-acquired
 * proctoring MediaStream (never calls getUserMedia itself). Used by the
 * middle-left camera button, the initial setup popup, and the anomaly alert.
 */
export function LearnWebcamPreview({ size = "sm", anomaly = false, caption = "proctoring" }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const attach = () => {
      if (cancelled) return;
      let stream: MediaStream | undefined;
      for (const key of STREAM_KEYS) {
        const s = getStream(key);
        if (s && s.getVideoTracks().length > 0) {
          stream = s;
          break;
        }
      }
      if (stream && videoRef.current) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        setHasStream(true);
        return;
      }
      // Camera may still be initialising — retry for a while.
      attempts += 1;
      if (attempts < 60) {
        window.setTimeout(attach, 500);
      }
    };

    attach();
    return () => {
      cancelled = true;
    };
  }, []);

  const width = size === "md" ? "w-72" : "w-52";
  const ring = anomaly ? "ring-danger-flash/80" : "ring-success-soft/70";
  const badgeBg = anomaly ? "bg-danger-flash/90" : "bg-success-strong/90";
  const badgeLabel = anomaly ? "ALERT" : "LIVE";

  return (
    <div
      className={`${width} rounded-2xl bg-glass p-2 text-stage-foreground backdrop-blur-md ring-1 ring-glass-border shadow-xl`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-stage">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover transition-opacity duration-300 ${hasStream ? "opacity-100" : "opacity-0"}`}
          style={{ transform: "scaleX(-1)" }}
        />
        {!hasStream && (
          <div className="absolute inset-0 grid place-items-center text-stage-foreground/60">
            <div className="flex flex-col items-center gap-1.5">
              <VideoOff className="h-5 w-5" />
              <span className="text-[10px]">Starting camera…</span>
            </div>
          </div>
        )}
        <div className={`pointer-events-none absolute inset-[6%] rounded-md ring-2 ${ring}`} />
        <div
          className={`absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full ${badgeBg} px-1.5 py-0.5 text-[10px] font-medium text-white`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-vibe-flash" />
          {badgeLabel}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-1 pb-0.5 text-xs">
        {anomaly ? (
          <>
            <ShieldAlert className="h-3.5 w-3.5 text-danger-flash" />
            <span className="opacity-90">Face not detected</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-3.5 w-3.5 text-success-soft" />
            <span className="opacity-90">All clear</span>
          </>
        )}
        <span className="ml-auto text-[10px] opacity-60">{caption}</span>
      </div>
    </div>
  );
}

export default LearnWebcamPreview;
