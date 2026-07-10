// @ts-ignore
import React from "react";

interface SignLanguageOverlayProps {
  mainVideoRef: { current: HTMLVideoElement | null };
  signLanguageUrl: string;
}

export function SignLanguageOverlay({
  mainVideoRef,
  signLanguageUrl,
}: SignLanguageOverlayProps) {
  const tutorVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 20, right: 20 });
  const dragStart = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    const main = mainVideoRef.current;
    const tutor = tutorVideoRef.current;
    if (!main || !tutor) return;

    const handlePlay = () => { tutor.play().catch(() => {}); };
    const handlePause = () => { tutor.pause(); };
    const handleSeeking = () => { tutor.currentTime = main.currentTime; };

    const handleTimeUpdate = () => {
      const drift = Math.abs(main.currentTime - tutor.currentTime);
      if (drift > 0.35) {
        tutor.currentTime = main.currentTime;
      }
    };

    main.addEventListener("play", handlePlay);
    main.addEventListener("pause", handlePause);
    main.addEventListener("seeking", handleSeeking);
    main.addEventListener("timeupdate", handleTimeUpdate);

    tutor.currentTime = main.currentTime;
    if (!main.paused) {
      tutor.play().catch(() => {});
    }

    return () => {
      main.removeEventListener("play", handlePlay);
      main.removeEventListener("pause", handlePause);
      main.removeEventListener("seeking", handleSeeking);
      main.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [mainVideoRef, signLanguageUrl]);

  const handleMouseDown = (e: any) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = dragStart.current.x - e.clientX;
      const deltaY = e.clientY - dragStart.current.y;

      setPosition((prev:{ top: number; right: number}) =>({
        right: Math.max(10, prev.right + deltaX),
        top: Math.max(10, prev.top + deltaY),
      }));

      dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: `${position.top}px`,
    right: `${position.right}px`,
    width: "220px",
    backgroundColor: "#1a1a1a",
    border: "2px solid #ffffff",
    borderRadius: "8px",
    boxShadow: "0px 10px 25px rgba(0,0,0,0.6)",
    zIndex: 100,
    overflow: "hidden",
    resize: "both",
    minWidth: "140px",
    minHeight: "105px",
  };

  const headerBarStyle: React.CSSProperties = {
    background: "#2d2d2d",
    color: "#ffffff",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "move",
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  const videoTrackStyle: React.CSSProperties = {
    width: "100%",
    height: "calc(100% - 28px)",
    objectFit: "cover",
    display: "block",
  };

  return React.createElement(
    "div",
    { style: containerStyle },
    React.createElement(
      "div",
      { onMouseDown: handleMouseDown, style: headerBarStyle },
      React.createElement("span", null, "🤟 "),
      "Sign Language Tutor"
    ),
    React.createElement("video", {
      ref: tutorVideoRef,
      src: signLanguageUrl,
      muted: true,
      style: videoTrackStyle,
    })
  );
}