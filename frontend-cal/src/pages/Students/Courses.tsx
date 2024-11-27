import RightClickDisabler from "@/components/proctoring-components/RightClickDisable";
import React, { useEffect, useRef, useState } from "react";

const Courses = () => {
  const videoPlayerRef = useRef(null);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }
  }, []);

  const initPlayer = () => {
    const playerInstance = new window.YT.Player(videoPlayerRef.current, {
      videoId: "1z-E_KOC2L0",
      playerVars: {
        enablejsapi: 1,
        controls: 0,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
    setPlayer(playerInstance);
  };

  const onPlayerReady = (event) => {
    const playerInstance = event.target;
    setDuration(playerInstance.getDuration());
    playerInstance.setVolume(volume);
  };

  const onPlayerStateChange = () => {
    if (player?.getPlayerState() === window.YT.PlayerState.PLAYING) {
      const interval = setInterval(() => {
        const currentTime = player?.getCurrentTime();
        setCurrentTime(currentTime);
      }, 1000);

      return () => clearInterval(interval);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="youtube-player h-full">
        <RightClickDisabler/>
      <div className="youtube-player h-4/5">
        <div className="full h-4/5 bg-gray-400 p-3 mx-40">
          <div ref={videoPlayerRef} className="w-full h-full"></div>
        </div>
      </div>
      <div className="h-1/5">
        Transcript
      </div>
    </div>
  );
};

export default Courses;
