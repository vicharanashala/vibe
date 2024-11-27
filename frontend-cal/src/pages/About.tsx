import React, { useEffect, useRef, useState } from "react";

const Abou = () => {
  const videoPlayerRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const playVideo = () => {
    player?.playVideo();
    setIsPlaying(true);
  };

  const pauseVideo = () => {
    player?.pauseVideo();
    setIsPlaying(false);
  };

  const stopVideo = () => {
    player?.stopVideo();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const toggleMute = () => {
    if (isMuted) {
      player?.unMute();
    } else {
      player?.mute();
    }
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    player?.setVolume(newVolume);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="youtube-player h-full">
      <div className="youtube-player flex h-4/5">
        <div className="w-1/4 h-4/5">Hello</div>
        <div className="w-3/4 h-4/5">
          <div ref={videoPlayerRef} className="w-full h-full"></div>
          <div className="controls">
            <div className="flex space-x-2">
              <button
                onClick={playVideo}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Play
              </button>
              <button
                onClick={pauseVideo}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Pause
              </button>
              <button
                onClick={stopVideo}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Stop
              </button>
              <button
                onClick={toggleMute}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
            </div>
            <div className="flex items-center mt-4">
              <label className="mr-2 text-sm">Volume:</label>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="w-32"
              />
            </div>
            <div className="flex items-center mt-4">
              <span className="text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Abou;
