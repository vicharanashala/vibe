import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video } from "@/types/video.types";
import Loader from "@/components/Loader";
import ConfirmationModal from "./confirmation-modal";

function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:v=|youtu\.be\/?)([\w-]{11})/);
    return match ? match[1] : null;
}

const YT_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

interface VideoModalProps {
    onClose: () => void;
    onSave: (video: Video) => void;
    onDelete?: () => void;
    onEdit?: () => void;
    item?: Video | null;
    action: "add" | "edit" | "view";
    selectedItemName: string;
    isLoading: boolean;
}

function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) {
        return "00:00";
    }

    const totalSeconds = Math.floor(seconds);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const formattedMins = mins.toString().padStart(2, "0");
    const formattedSecs = secs.toString().padStart(2, "0");

    return `${formattedMins}:${formattedSecs}`;
}

function parseTimeToSeconds(time: string | undefined): number {
    if (!time || time.trim() === "") {
        return 0;
    }

    const normalizedTime = time.trim();

    const timeParts = normalizedTime.split(":");

    if (timeParts.length === 3) {
        const [hours, minutes, seconds] = timeParts;

        const h = Math.max(0, parseInt(hours, 10) || 0);
        const m = Math.min(59, Math.max(0, parseInt(minutes, 10) || 0));
        const s = Math.min(59, Math.max(0, parseInt(seconds, 10) || 0));

        return (h * 60 + m) * 60 + s;
    }

    if (timeParts.length === 2) {
        // Format: MM:SS
        const [minutes, seconds] = timeParts;

        const m = Math.max(0, parseInt(minutes, 10) || 0);
        const s = Math.min(59, Math.max(0, parseInt(seconds, 10) || 0));

        return m * 60 + s;
    }

    // Handle plain number (assume it's seconds)
    if (!normalizedTime.includes(":")) {
        const seconds = parseInt(normalizedTime, 10);
        return isNaN(seconds) ? 0 : Math.max(0, seconds);
    }

    return 0;
}

const VideoModal: React.FC<VideoModalProps> = ({
    selectedItemName,
    isLoading,
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
    const [url, setUrl] = useState(item?.details?.URL || "");
    const [duration, setDuration] = useState(0);
    const [playerReady, setPlayerReady] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [showOverlay, setShowOverlay] = useState(false);
    const [showDeleteVideoModal, setShowDeleteVideoModal] = useState(false)
    const [errors, setErrors] = useState({
        startTime: "",
        endTime: ""
    });

    const [range, setRange] = useState<[number, number]>([
        item?.details?.startTime ? parseTimeToSeconds(String(item.details?.startTime)) : 0,
        item?.details?.endTime ? parseTimeToSeconds(String(item.details?.endTime)) : 0,
    ]);
    const [videoId, setVideoId] = useState<string | null>(getYouTubeId(item?.details?.URL + "?rel=0" || ""));
    const [points, setPoints] = useState<number>(item?.details?.points ?? 0);
    const [timeInputs, setTimeInputs] = useState({
        start: formatTime(item?.details?.startTime ? parseTimeToSeconds(String(item.details?.startTime)) : 0),
        end: formatTime(item?.details?.endTime ? parseTimeToSeconds(String(item.details?.endTime)) : 0),
    });

    const playerRef = useRef<any>(null);
    const iframeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.YT && window.YT.Player) return;
        const tag = document.createElement("script");
        tag.src = YT_IFRAME_API_SRC;
        document.body.appendChild(tag);
    }, []);

    useEffect(() => {
        setPlayerReady(false);
        setDuration(0);
        setCurrentTime(0);
        const id = getYouTubeId(url);
        setVideoId(id);
        if (!id) {
            setRange([0, 0]);
            setTimeInputs({ start: "0:00", end: "0:00" });
        }
    }, [url]);

    useEffect(() => {
        setName(item?.name || "");
        setDescription(item?.description || "");
        setUrl(item?.details?.URL || "");
        setPoints(item?.details?.points ?? 0);

        const startTime = item?.details?.startTime || "0:00";
        const endTime = item?.details?.endTime || "0:00";

        setRange([
            parseTimeToSeconds(startTime),
            parseTimeToSeconds(endTime),
        ]);

        setTimeInputs({
            start: formatTime(parseTimeToSeconds(startTime)),
            end: formatTime(parseTimeToSeconds(endTime)),
        });

        setVideoId(getYouTubeId((item?.details.URL ?? "") + "?rel=0"));
        setPlayerReady(false);
        setDuration(0);
        setCurrentTime(0);
    }, [item]);


    // useEffect(() => {
    //   setPlayerReady(false);   // move it here
    // }, [videoId]);
    // Create/destroy player on videoId change
    useEffect(() => {
        setPlayerReady(false)
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

                    const currentEnd = parseTimeToSeconds(timeInputs.end);
                    const newEnd = currentEnd > 0 ? Math.min(currentEnd, dur) : dur;

                    const startSeconds = parseTimeToSeconds(timeInputs.start);

                    setRange([startSeconds, newEnd]);

                    const formattedEnd = formatTime(newEnd);

                    setTimeInputs(prev => {
                        const updated = {
                            ...prev,
                            end: formattedEnd
                        };
                        return updated;
                    });

                    validateTimeAgainstDuration(timeInputs.start, 'startTime', dur);
                    validateTimeAgainstDuration(timeInputs.end, 'endTime', dur);

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

    const validateTimeAgainstDuration = (timeValue: string, field: 'startTime' | 'endTime', maxDuration: number) => {
        const seconds = parseTimeToSeconds(timeValue);

        if (seconds > maxDuration) {
            setErrors(prev => ({
                ...prev,
                [field]: `Time exceeds video duration (${formatTime(maxDuration)})`
            }));
            return false;
        } else {
            setErrors(prev => ({
                ...prev,
                [field]: ""
            }));
            return true;
        }
    };

    const validateTimeRange = (startTime: string, endTime: string) => {
        const startSeconds = parseTimeToSeconds(startTime);
        const endSeconds = parseTimeToSeconds(endTime);

        if (endSeconds <= startSeconds) {
            setErrors(prev => ({
                ...prev,
                endTime: "End time must be greater than start time"
            }));
            return false;
        } else {
            setErrors(prev => ({
                ...prev,
                endTime: ""
            }));
            return true;
        }
    };

    const formatTimeInput = (value: string): string => {
        const digits = value.replace(/\D/g, '');

        if (digits.length > 4) return value;

        if (digits.length <= 2) {
            return digits;
        } else {
            const minutes = digits.slice(0, -2);
            const seconds = digits.slice(-2);
            return `${minutes}:${seconds}`;
        }
    };

    const validateTimeInput = (value: string, maxSeconds: number): number => {
        if (!value) return 0;
        const formattedValue = formatTimeInput(value);
        let seconds = parseTimeToSeconds(formattedValue);
        seconds = Math.min(seconds, maxSeconds);
        return seconds;
    };

    const handleTimeInputChange = (type: 'start' | 'end', value: string) => {
        const numericOnly = value.replace(/\D/g, '');

        // Limit to 6 digits total (HHMMSS)
        if (numericOnly.length > 6) return;



        setTimeInputs(prev => ({
            ...prev,
            [type]: value
        }));
    };

    const handleTimeInputBlur = (type: 'start' | 'end') => {
        const rawValue = timeInputs[type];

        // Only format if the value is not empty
        if (rawValue.trim() === "") {
            setTimeInputs(prev => ({
                ...prev,
                [type]: "0:00"
            }));
            // Validate after setting to 0:00
            const otherType = type === 'start' ? 'end' : 'start';
            validateTimeRange(
                type === 'start' ? "0:00" : timeInputs[otherType],
                type === 'start' ? timeInputs[otherType] : "0:00"
            );
            return;
        }

        const formattedValue = formatTimeInput(rawValue);
        const seconds = validateTimeInput(formattedValue, duration);
        const field = type === 'start' ? 'startTime' : 'endTime';

        // Update state with clean formatted value
        setTimeInputs(prev => ({
            ...prev,
            [type]: formattedValue
        }));

        // Only validate against duration if video has loaded properly
        if (duration > 0) {
            validateTimeAgainstDuration(formattedValue, field, duration);
        }

        // Validate time range (end > start) - use updated state
        setTimeout(() => {
            const otherType = type === 'start' ? 'end' : 'start';
            const currentStart = type === 'start' ? formattedValue : timeInputs[otherType];
            const currentEnd = type === 'start' ? timeInputs[otherType] : formattedValue;
            validateTimeRange(currentStart, currentEnd);
        }, 0);

        // Update player range
        if (type === 'start') {
            setRange(prev => {
                const newStart = Math.min(seconds, prev[1] - 1);
                if (playerRef.current && playerReady) {
                    playerRef.current.seekTo(newStart, true);
                }
                return [newStart, prev[1]];
            });
        } else {
            setRange(prev => {
                const newEnd = Math.max(seconds, prev[0] + 1);
                return [prev[0], newEnd];
            });
        }
    };

    // Store original values for cancel functionality
    const [originalValues, setOriginalValues] = useState({
        name: item?.name || "",
        description: item?.description || "",
        url: item?.details?.URL || "",
        startTime: item?.details?.startTime || "0:00",
        endTime: item?.details?.endTime || "0:00",
        points: item?.details?.points ?? 0
    });

    // Update original values when item changes
    useEffect(() => {
        setOriginalValues({
            name: item?.name || "",
            description: item?.description || "",
            url: item?.details?.URL || "",
            startTime: item?.details?.startTime || "0:00",
            endTime: item?.details?.endTime || "0:00",
            points: item?.details?.points ?? 0
        });
    }, [item]);

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

    const hasErrors = () => {
        return errors.startTime !== "" || errors.endTime !== "";
    };
    const [errorList, setErrorList] = useState({ name: "", description: "", url: "" })
    const errorMessages = {
        name: "Video name is required",
        description: "Video description is required",
        url: "Video url is reqired"
    }
    const [skipIntialRender, setSkipIntialRender] = useState(true)
    useEffect(() => {
        if (!skipIntialRender) {
            setErrorList({
                name: name ? "" : errorMessages.name,
                description: description ? "" : errorMessages.description,
                url: url ? "" : errorMessages.url,

            })
        }
    }, [name, description, url])
    // Handle Cancel with restore functionality
    const handleCancel = () => {
        // Restore original values
        setName(originalValues.name);
        setDescription(originalValues.description);
        setUrl(originalValues.url);
        setPoints(originalValues.points);
        setTimeInputs({
            start: originalValues.startTime,
            end: originalValues.endTime
        });
        setRange([
            parseTimeToSeconds(originalValues.startTime),
            parseTimeToSeconds(originalValues.endTime)
        ]);
        setErrors({ startTime: "", endTime: "" });
        setErrorList({ name: "", description: "", url: "" });

        onClose();
    };
    const handleSave = () => {
        setSkipIntialRender(false);

        const newErrors = {
            name: name ? "" : errorMessages.name,
            description: description ? "" : errorMessages.description,
            url: url ? "" : errorMessages.url,
        };

        setErrorList(newErrors);
        const isValid = Object.values(newErrors).every((err) => err === "");
        if (!isValid) return;

        const startSeconds = validateTimeInput(timeInputs.start, duration);
        const endSeconds = validateTimeInput(timeInputs.end, duration);

        const startValid = validateTimeAgainstDuration(timeInputs.start, "startTime", duration);
        const endValid = validateTimeAgainstDuration(timeInputs.end, "endTime", duration);
        const rangeValid = validateTimeRange(timeInputs.start, timeInputs.end);

        if (!startValid || !endValid || !rangeValid) return;

        const video: Video = {
            _id: item?._id || "",
            name,
            description,
            type: "VIDEO",
            details: {
                URL: url,
                startTime: formatTime(startSeconds),
                endTime: formatTime(endSeconds),
                points,
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

    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (videoId) {
            modalRef.current?.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        }
    }, [videoId]);


    return (
        <>
            {isLoading ? <Loader /> :
                <div
                    ref={modalRef}
                    className="bg-background rounded-lg p-6 
             backdrop-blur-md bg-background/80 border
              overflow-y-auto
                min-w-4xl"
                >


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
                        </span>
                        ) : null}
                    </div>
                    <div className="space-y-4">
                        <Input
                            placeholder="Video Name *"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={action === "view"}
                        />
                        {errorList.name && (
                            <p className="text-xs text-red-500 mt-1">{errorList.name}</p>
                        )}
                        <Input
                            placeholder="Paste YouTube video URL *"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            disabled={action === "view"}
                        />
                        {errorList.url && (
                            <p className="text-xs text-red-500 mt-1">{errorList.url}</p>
                        )}
                        <textarea
                            placeholder="Description *"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            disabled={action === "view"}
                            rows={3}
                            className="w-full rounded border px-3 py-2 text-sm"
                        />
                        {errorList.description && (
                            <p className="text-xs text-red-500 mt-1">{errorList.description}</p>
                        )}
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
                                                <circle cx="64" cy="64" r="64" fill="#FFF" fillOpacity="0.2" />
                                                <polygon points="52,40 96,64 52,88" fill="#FFF" />
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
                                        Start: {timeInputs.start} &nbsp; End: {timeInputs.end} &nbsp; Current: {formatTime(currentTime)}
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
                                    }}
                                    className="xl:flex items-center justify-start relative gap-2"
                                >
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center lg:gap-2 gap-6 lg:flex-row flex-col">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <label className="font-medium mr-2">Start Time (mm:ss):</label>
                                                    <div className="flex flex-col">
                                                        <Input
                                                            type="text"
                                                            value={timeInputs.start}
                                                            onChange={e => handleTimeInputChange('start', e.target.value)}
                                                            onBlur={() => handleTimeInputBlur('start')}
                                                            disabled={action === "view"}
                                                            style={{ width: 100 }}
                                                            placeholder="0:00"
                                                            maxLength={5}
                                                            className={errors.startTime ? "border-red-500" : ""}
                                                        />
                                                    </div>
                                                </div>
                                                {errors.startTime && (
                                                    <span className="text-red-500 text-xs mt-1 absolute">{errors.startTime}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <label className="font-medium ml-4 mr-2">End Time (mm:ss):</label>
                                                    <div className="flex flex-col">
                                                        <Input
                                                            type="text"
                                                            value={timeInputs.end}
                                                            onChange={e => handleTimeInputChange('end', e.target.value)}
                                                            onBlur={() => handleTimeInputBlur('end')}
                                                            disabled={action === "view"}
                                                            style={{ width: 100 }}
                                                            placeholder="0:00"
                                                            maxLength={5}
                                                            className={errors.endTime ? "border-red-500" : ""}
                                                        />
                                                    </div>
                                                </div>
                                                {errors.endTime && (
                                                    <span className="text-red-500 text-xs mt-1">{errors.endTime}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Go to Start/End Buttons */}
                                    <div className="mt-4 xl:mt-0 justify-center" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
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
                        <div className="mt-2">
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
                                <Button variant="outline" onClick={handleCancel}>
                                    Cancel
                                </Button>
                                {action === "edit" && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (typeof onDelete === "function") {
                                                setShowDeleteVideoModal(true)
                                            }
                                        }}
                                    >
                                        Delete Video
                                    </Button>
                                )}
                                {(() => {
                                    const hasTimeRangeError = () => {
                                        const startSeconds = parseTimeToSeconds(timeInputs.start);
                                        const endSeconds = parseTimeToSeconds(timeInputs.end);
                                        return endSeconds <= startSeconds;
                                    };
                                    return (
                                        <Button
                                            onClick={handleSave}
                                            disabled={!playerReady || !url || hasErrors() || hasTimeRangeError()}
                                        >
                                            {action === "add" ? "Add Item " : "Update Video"}
                                        </Button>
                                    );
                                })()}

                            </div>

                        )}
                        <div className="relative group">
                            <ConfirmationModal
                                isOpen={showDeleteVideoModal}
                                onClose={() => setShowDeleteVideoModal(false)}
                                onConfirm={onDelete}
                                title="Delete Video"
                                description="This will delete this video. Are you sure you want to delete it?"
                                confirmText="Delete"
                                cancelText="Cancel"
                                isDestructive={true}
                                // isLoading={}
                                loadingText="Deleting..."
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        </div>

                    </div>
                </div>
            }
        </>
    );
};

export default VideoModal;