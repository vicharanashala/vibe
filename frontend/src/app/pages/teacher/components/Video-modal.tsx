import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video } from "@/types/video.types";

function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:v=|youtu\.be\/?)([\w-]{11})/);
    return match ? match[1] : null;
}

const YT_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

interface VideoModalProps {
    onClose: () => void;
    onSave: (video: Video) => void;
    onDelete?: () => void;
    onEdit?: () => void; // Add this prop
    item?: Video | null;
    action: "add" | "edit" | "view";
    selectedItemName:string,
}

const VideoModal: React.FC<VideoModalProps> = ({
    selectedItemName,
    onClose,
    onSave,
    onDelete,
    onEdit,
    item,
    action,
}) => {
    // State for fields
    const [name, setName] = useState(item?.name || "");
    const [description, setDescription] = useState(item?.description || "");
    const [url, setUrl] = useState(item?.details.URL || "");
    const [duration, setDuration] = useState(0);
    const [playerReady, setPlayerReady] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [showOverlay, setShowOverlay] = useState(false);
    // Helper to convert "mm:ss.ms" or "hh:mm:ss.ms" to seconds
    function parseTimeToSeconds(time: string | undefined): number {
        if (!time) return 0;
        // Match hh:mm:ss.ms or mm:ss.ms or ss.ms
        const parts = time.split(":").map(Number);
        if (parts.some(isNaN)) return 0;
        if (parts.length === 3) {
            // hh:mm:ss.ms
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            // mm:ss.ms
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 1) {
            // ss.ms
            return parts[0];
        }
        return 0;
    }

    const [range, setRange] = useState<[number, number]>([
        item?.details.startTime ? parseTimeToSeconds(item.details.startTime) : 0,
        item?.details.endTime ? parseTimeToSeconds(item.details.endTime) : 0,
    ]);
    const [videoId, setVideoId] = useState<string | null>(getYouTubeId(item?.details.URL+"?rel=0" || ""));
    const [points, setPoints] = useState<number>(item?.details.points ?? 0);

    const playerRef = useRef<any>(null);
    const iframeRef = useRef<HTMLDivElement>(null);

    // Load YouTube IFrame API
    useEffect(() => {
        if (window.YT && window.YT.Player) return;
        const tag = document.createElement("script");
        tag.src = YT_IFRAME_API_SRC;
        document.body.appendChild(tag);
    }, []);

    // Reset state on URL change
    useEffect(() => {
        setPlayerReady(false);
        setDuration(0);
        setCurrentTime(0);
        const id = getYouTubeId(url);
        setVideoId(id);
        if (!id) {
            setRange([0, 0]);
        }
    }, [url]);

    // Refresh state when item changes
    useEffect(() => {
        setName(item?.name || "");
        setDescription(item?.description || "");
        setUrl(item?.details.URL || "");
        setPoints(item?.details.points ?? 0);
        setRange([
            item?.details.startTime ? parseTimeToSeconds(item.details.startTime) : 0,
            item?.details.endTime ? parseTimeToSeconds(item.details.endTime) : 0,
        ]);
        setVideoId(getYouTubeId((item?.details.URL ?? "") + "?rel=0"));
        setPlayerReady(false);
        setDuration(0);
        setCurrentTime(0);
    }, [item]);

    // Create/destroy player on videoId change
    useEffect(() => {
        if (!videoId || !iframeRef.current || !(window.YT && window.YT.Player)) return;

        playerRef.current = new window.YT.Player(iframeRef.current, {
            videoId,
            playerVars: {
                controls: 1,
                modestbranding: 1,
                rel: 0,
                fs: 0,
                autoplay: 0,
            },
            events: {
                onReady: (event: any) => {
                    const dur = event.target.getDuration();
                    setDuration(dur);
                    setRange(prev =>
                        prev[1] > 0 ? prev : [0, dur]
                    );
                    setPlayerReady(true);
                    setShowOverlay(false);
                },
                onStateChange: (event: any) => {
                    // Show overlay when ended
                    if (event.data === window.YT.PlayerState.ENDED) {
                        setShowOverlay(true);
                    } else if (event.data === window.YT.PlayerState.PLAYING) {
                        setShowOverlay(false);
                    }
                },
            },
        });

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [videoId]);

    // Poll current time
    useEffect(() => {
        if (!playerReady) return;
        const interval = setInterval(() => {
            if (playerRef.current && playerRef.current.getCurrentTime) {
                setCurrentTime(playerRef.current.getCurrentTime());
            }
        }, 300);
        return () => clearInterval(interval);
    }, [playerReady]);

    // Seek video when start/end time is changed
    const handleStartTimeChange = (value: string) => {
        const start = parseFloat(value) || 0;
        setRange(([_, end]) => {
            // Ensure start < end
            const newStart = Math.min(start, end - 0.1);
            if (playerRef.current && playerReady) {
                playerRef.current.seekTo(newStart, true);
            }
            return [newStart, end];
        });
    };

    const handleEndTimeChange = (value: string) => {
        const end = parseFloat(value) || 0;
        setRange(([start, _]) => {
            // Ensure end > start
            const newEnd = Math.max(end, start + 0.1);
            return [start, newEnd];
        });
    };

    // Only constrain playback to [start, end]
    useEffect(() => {
        if (!playerReady) return;
        const [start, end] = range;
        if (currentTime < start) {
            playerRef.current.seekTo(start, true);
        }
        if (currentTime > end) {
            playerRef.current.seekTo(end, true);
            if (playerRef.current && playerRef.current.pauseVideo) {
                playerRef.current.pauseVideo();
            }
        }
    }, [currentTime, range, playerReady]);

    // Handle Save
    const handleSave = () => {
        const video: Video = {
            _id: item?._id || "",
            name,
            description,
            type: "VIDEO",
            details: {
                URL: url,
                startTime: range[0].toString(),
                endTime: range[1].toString(),
                points: points,
            },
        };
        onSave(video);
    };

    // Overlay click handler
    const handleOverlayClick = () => {
        if (playerRef.current) {
            playerRef.current.seekTo(range[0], true);
            playerRef.current.playVideo();
            setShowOverlay(false);
        }
    };

    return (
        <div className="bg-background rounded-lg border p-6 min-w-[700px] backdrop-blur-md bg-background/80">
            <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">
                    {action === "add" && "Add Video"}
                    {action === "edit" && "Edit Video"}
                    {action === "view" && `${selectedItemName || "View Video"}`}
                </h2>
                {action === "view" ? (<span className="flex items-center">
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-xs mr-4"
                        onClick={onEdit}
                    >
                        Edit
                    </Button>
                    {/* <Button className="text-xs gap-1" variant="outline" size="sm">
                <FlagTriangleRight className="h-4 w-4 mr-1" />
                View Flags
              </Button> */}
              </span>
                ) : null}
                {/* Remove Close button from here */}
            </div>
            <div className="space-y-4">
                <Input
                    placeholder="Video Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={action === "view"}
                />
                <Input
                    placeholder="Paste YouTube video URL"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    disabled={action === "view"}
                />
                <textarea
                    placeholder="Description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    disabled={action === "view"}
                    rows={3}
                    className="w-full rounded border px-3 py-2 text-sm"
                />
                {videoId && (
                    <div
                        style={{
                            width: "100%",
                            maxWidth: 720,
                            margin: "0 auto",
                            borderRadius: 12,
                            overflow: "hidden",
                            background: "hsl(var(--background))",
                            boxShadow: "0 2px 16px rgba(30,41,59,0.10)",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        {/* Video Container */}
                        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000" }}>
                            <div
                                ref={iframeRef}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    background: "#000",
                                    borderRadius: "12px 12px 0 0",
                                    overflow: "hidden",
                                    position: "relative",
                                }}
                            />
                            {/* Overlay */}
                            {showOverlay && (
                                <div
                                    onClick={handleOverlayClick}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: "rgba(0,0,0,0.7)",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        zIndex: 20,
                                    }}
                                >
                                    {/* SVG Play Icon */}
                                    <svg width="64" height="64" viewBox="0 0 128 128" fill="none">
                                        <circle cx="64" cy="64" r="64" fill="#FFF" fillOpacity="0.2"/>
                                        <polygon points="52,40 96,64 52,88" fill="#FFF"/>
                                    </svg>
                                </div>
                            )}
                            {/* Time display */}
                            <div style={{
                                position: "absolute",
                                left: 16,
                                bottom: 48,
                                color: "#fff",
                                textShadow: "0 1px 4px #000",
                                fontWeight: 600,
                                fontSize: 15,
                                zIndex: 11,
                            }}>
                                Start: {range[0].toFixed(1)}s &nbsp; End: {range[1].toFixed(1)}s &nbsp; Current: {currentTime.toFixed(1)}s
                            </div>
                        </div>
                        {/* Start/End Time Inputs Below Video */}
                        <div
                            style={{
                                background: 'hsl(var(--card))',
                                padding: '16px',
                                borderTop: '1px solid hsl(var(--primary) / 0.2)',
                                borderRadius: '0 0 12px 12px',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                                flexShrink: 0,
                                display: 'flex',
                                gap: '16px',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                position: 'relative',
                            }}
                        >
                            <label className="font-medium mr-2">Start Time (s):</label>
                            <Input
                                type="number"
                                min={0}
                                max={range[1] - 0.1}
                                step={0.1}
                                value={range[0]}
                                onChange={e => handleStartTimeChange(e.target.value)}
                                disabled={!playerReady || action === "view"}
                                style={{ width: 100 }}
                            />
                            <label className="font-medium ml-4 mr-2">End Time (s):</label>
                            <Input
                                type="number"
                                min={range[0] + 0.1}
                                max={duration}
                                step={0.1}
                                value={range[1]}
                                onChange={e => handleEndTimeChange(e.target.value)}
                                disabled={!playerReady || action === "view"}
                                style={{ width: 100 }}
                            />
                            {/* Go to Start/End Buttons */}
                            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        if (playerRef.current && playerReady) {
                                            playerRef.current.seekTo(range[0], true);
                                        }
                                    }}
                                    disabled={!playerReady}
                                >
                                    Go to Start
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        if (playerRef.current && playerReady) {
                                            playerRef.current.seekTo(range[1], true);
                                        }
                                    }}
                                    disabled={!playerReady}
                                >
                                    Go to End
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                <div>
                    <label className="block mb-1 font-medium">Points</label>
                    <Input
                        type="number"
                        min={0}
                        value={points}
                        onChange={e => setPoints(Number(e.target.value))}
                        disabled={action === "view"}
                        style={{ width: 120 }}
                    />
                </div>
                {(action === "add" || action === "edit") && (
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        {action === "edit" && (
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (typeof onDelete === "function") onDelete();
                                }}
                            >
                                Delete
                            </Button>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={!playerReady || !url}
                        >
                            {action === "add" ? "Add Item " : "Update Item"}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoModal;