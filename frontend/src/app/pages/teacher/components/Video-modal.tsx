import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video } from "@/types/video.types";
import Loader from "@/components/Loader";
import ConfirmationModal from "./confirmation-modal";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import VideoAssetPicker from "./VideoAssetPicker";
import HlsVideoPlayer from "@/components/HlsVideoPlayer";
import { resolveVideoSource, type VideoSource } from "@/types/media.types";
import TimeRangePicker from "./TimeRangePicker";
import { formatTime, parseTimeToSeconds } from "@/utils/time";

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
    /**
     * Course scope for uploads. Optional so existing call sites keep working —
     * without them the Upload option is offered but disabled, rather than
     * letting a teacher start an upload that has nowhere to go.
     */
    courseId?: string | null;
    courseVersionId?: string | null;
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
    courseId,
    courseVersionId,
}) => {
    // State for fields
    const [name, setName] = useState(item?.name || "");
    const [description, setDescription] = useState(item?.description || "");
    const [url, setUrl] = useState(item?.details?.URL || "");
    /**
     * Where this item's video comes from. Existing items have no `source`, so
     * resolveVideoSource reads them as YOUTUBE and the link flow below is
     * unchanged for them.
     */
    const [source, setSource] = useState<VideoSource>(
        resolveVideoSource(item?.details),
    );
    const [assetId, setAssetId] = useState<string | undefined>(
        item?.details?.assetId,
    );
    const canUpload = Boolean(courseId && courseVersionId);
    /** This item plays an uploaded video rather than a YouTube link. */
    const isUpload = source === "GCS";
    const [duration, setDuration] = useState(0);
    const [playerReady, setPlayerReady] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [showOverlay, setShowOverlay] = useState(false);
    const [showDeleteVideoModal, setShowDeleteVideoModal] = useState(false)

    /**
     * The segment bounds, in seconds — the single source of truth for both
     * timestamps. Display strings are derived where they are shown and built
     * once more on save, rather than being kept as a parallel copy of state.
     */
    const [range, setRange] = useState<[number, number]>([
        item?.details?.startTime ? parseTimeToSeconds(String(item.details?.startTime)) : 0,
        item?.details?.endTime ? parseTimeToSeconds(String(item.details?.endTime)) : 0,
    ]);
    /** Reported by TimeRangePicker, which owns timestamp validation. */
    const [timeRangeInvalid, setTimeRangeInvalid] = useState(false);
    const [videoId, setVideoId] = useState<string | null>(getYouTubeId(item?.details?.URL + "?rel=0" || ""));
    const [points, setPoints] = useState<number>(item?.details?.points ?? 0);
    const [isLensEnabled, setIsLensEnabled] = useState(item?.details?.isLensEnabled !== false);

    const playerRef = useRef<any>(null);
    const iframeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.YT && window.YT.Player) return;
        const tag = document.createElement("script");
        tag.src = YT_IFRAME_API_SRC;
        document.body.appendChild(tag);
    }, []);

    useEffect(() => {
        const id = getYouTubeId(url);
        setVideoId(id);
        setCurrentTime(0);
        if (!id) {
            setPlayerReady(true);
            setRange([0, 150]);
            setDuration(150);
        } else {
            setRange([0, 0]);
            setPlayerReady(false);
            setDuration(0);
        }
    }, [url]);

    useEffect(() => {
        setName(item?.name || "");
        setDescription(item?.description || "");
        setUrl(item?.details?.URL || "");
        // `item` arrives asynchronously, so the initial useState values were
        // computed while it was still undefined — i.e. as a YouTube video. These
        // two must be re-synced here alongside the rest, or opening a saved
        // upload shows an empty "Paste YouTube video URL" field.
        setSource(resolveVideoSource(item?.details));
        setAssetId(item?.details?.assetId);
        setPoints(item?.details?.points ?? 0);

        const startTime = item?.details?.startTime || "0:00";
        const endTime = item?.details?.endTime || "0:00";

        const startSec = parseTimeToSeconds(startTime);
        const endSec = parseTimeToSeconds(endTime);

        setRange([
            startSec,
            endSec || 150,
        ]);

        const isYt = !!getYouTubeId(item?.details?.URL || "");
        setVideoId(getYouTubeId((item?.details?.URL ?? "") + "?rel=0"));
        setCurrentTime(0);
        if (!isYt) {
            setPlayerReady(true);
            setDuration(endSec || 150);
        } else {
            setPlayerReady(false);
            setDuration(0);
        }
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

                    // An end of 0 means "not set yet" — default it to the whole
                    // video. Anything already set is only pulled back if it
                    // overruns the real length.
                    setRange(prev => [
                        Math.min(prev[0], dur),
                        prev[1] > 0 ? Math.min(prev[1], dur) : dur,
                    ]);

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

    /**
     * Timestamp edits arrive from TimeRangePicker already parsed and bounded.
     * Moving the start also seeks the player, so the teacher sees the frame
     * they just chose.
     */
    const handleRangeChange = ({start, end}: {start: number; end: number}) => {
        setRange(prev => {
            if (start !== prev[0] && playerRef.current && playerReady) {
                playerRef.current.seekTo(start, true);
            }
            return [start, end];
        });
    };

    // Store original values for cancel functionality
    const [originalValues, setOriginalValues] = useState({
        name: item?.name || "",
        description: item?.description || "",
        url: item?.details?.URL || "",
        startTime: item?.details?.startTime || "0:00",
        endTime: item?.details?.endTime || "0:00",
        points: item?.details?.points ?? 0,
        isLensEnabled: item?.details?.isLensEnabled !== false
    });

    // Update original values when item changes
    useEffect(() => {
        setOriginalValues({
            name: item?.name || "",
            description: item?.description || "",
            url: item?.details?.URL || "",
            startTime: item?.details?.startTime || "0:00",
            endTime: item?.details?.endTime || "0:00",
            points: item?.details?.points ?? 0,
            isLensEnabled: item?.details?.isLensEnabled !== false
        });
        setIsLensEnabled(item?.details?.isLensEnabled !== false);
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


    /**
     * Default an uploaded video's segment to its full length.
     *
     * The YouTube flow gets its range from the IFrame player as it loads. The
     * upload flow has no such player, so start and end would both stay at 0:00 —
     * which handleSave rejects as an invalid range, silently refusing to save.
     * A whole uploaded video is the sensible default; the teacher can still trim
     * it afterwards.
     */
    useEffect(() => {
        if (source !== "GCS" || duration <= 0) return;
        setRange(prev => (prev[1] > 0 ? prev : [0, duration]));
    }, [source, duration]);
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
        setIsLensEnabled(originalValues.isLensEnabled);
        setRange([
            parseTimeToSeconds(originalValues.startTime),
            parseTimeToSeconds(originalValues.endTime)
        ]);
        setTimeRangeInvalid(false);
        setErrorList({ name: "", description: "", url: "" });

        onClose();
    };
    const handleSave = () => {
        setSkipIntialRender(false);

        const newErrors = {
            name: name ? "" : errorMessages.name,
            description: description ? "" : errorMessages.description,
            // An uploaded video has no URL to validate — it needs an asset instead.
            url:
                source === "GCS"
                    ? assetId
                        ? ""
                        : "Upload a video before saving"
                    : url
                        ? ""
                        : errorMessages.url,
        };

        setErrorList(newErrors);
        const isValid = Object.values(newErrors).every((err) => err === "");
        if (!isValid) return;

        // A brand new item whose player has not reported a length yet has no
        // meaningful segment to save; the bounds are filled in on first open.
        const isUnmeasured = action === "add" && duration === 0;
        const [startSeconds, endSeconds] = isUnmeasured ? [0, 0] : range;

        // TimeRangePicker keeps this current, and Save is disabled while it is
        // set — this is the backstop for a programmatic call.
        if (timeRangeInvalid) return;

        const video: Video = {
            _id: item?._id || "",
            name,
            description,
            type: "VIDEO",
            details: {
                // The two sources are mutually exclusive: the backend validator
                // rejects a URL alongside an assetId, so send only the relevant
                // one. `source` is omitted for YouTube so items written here look
                // exactly like every item written before uploads existed.
                ...(source === "GCS"
                    ? { source: "GCS" as VideoSource, assetId }
                    : { URL: url }),
                startTime: formatTime(startSeconds),
                endTime: formatTime(endSeconds),
                points,
                isLensEnabled: isLensEnabled,
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
                    /**
                     * Height is capped to the viewport so the modal scrolls inside
                     * itself. Without a cap it grew taller than the screen, and
                     * because the overlay centres it with flex, the overflow was
                     * clipped off the top where it cannot be scrolled to — the
                     * video name field became unreachable.
                     *
                     * Width is a max rather than a min for the same reason: min-w
                     * forced the modal wider than a narrow window.
                     */
                    className="bg-card text-foreground rounded-lg p-6
                    overflow-y-auto max-h-[90vh]
                    w-full max-w-4xl mx-4 shadow-lg"
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
                            className="bg-background border-border"
                        />
                        {errorList.name && (
                            <p className="text-xs text-red-500 mt-1">{errorList.name}</p>
                        )}
                        {/*
                          * Source picker. Hidden in view mode and for existing
                          * items — switching an item's source after learners have
                          * progress against it would orphan their watch history,
                          * so it is a create-time choice only.
                          */}
                        {action === "add" && (
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={source === "YOUTUBE" ? "default" : "outline"}
                                    onClick={() => setSource("YOUTUBE")}
                                >
                                    YouTube link
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={source === "GCS" ? "default" : "outline"}
                                    disabled={!canUpload}
                                    title={
                                        canUpload
                                            ? undefined
                                            : 'Open this from a course to choose a video'
                                    }
                                    onClick={() => setSource("GCS")}
                                >
                                    Course video
                                </Button>
                            </div>
                        )}

                        {source === "GCS" ? (
                            <>
                                {courseId && courseVersionId ? (
                                    <>
                                        <VideoAssetPicker
                                            courseId={courseId}
                                            courseVersionId={courseVersionId}
                                            assetId={assetId}
                                            disabled={action === "view"}
                                            onSelect={asset => {
                                                setAssetId(asset.assetId);
                                                // A known duration lets the range
                                                // default to the whole video before
                                                // the preview has even loaded.
                                                if (asset.durationSeconds) {
                                                    setDuration(asset.durationSeconds);
                                                }
                                            }}
                                        />
                                        {/*
                                          * The preview itself renders below, in the same
                                          * container as the timestamp controls, so an
                                          * uploaded video is edited exactly like a YouTube
                                          * one.
                                          */}
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Open this from a course to choose a video.
                                    </p>
                                )}
                                {errorList.url && (
                                    <p className="text-xs text-red-500 mt-1">{errorList.url}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <Input
                                    placeholder="Paste YouTube video URL *"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    disabled={action === "view"}
                                    className="bg-background border-border"
                                />
                                {errorList.url && (
                                    <p className="text-xs text-red-500 mt-1">{errorList.url}</p>
                                )}
                            </>
                        )}
                        <textarea
                            placeholder="Description *"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            disabled={action === "view"}
                            rows={3}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm
                                bg-card text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        {errorList.description && (
                            <p className="text-xs text-red-500 mt-1">{errorList.description}</p>
                        )}
                        {/*
                          * Gated on "a video is loaded", not on a YouTube id — the
                          * timestamp controls live inside this block, and keying it to
                          * videoId meant an uploaded video had no way to set start and
                          * end at all.
                          */}
                        {(videoId || (isUpload && assetId)) && (
                            <div
                                style={{
                                    width: "100%",
                                    maxWidth: 720,
                                    margin: "0 auto",
                                    borderRadius: 12,
                                    overflow: "hidden",
                                    background: "var(--card)",
                                    border: "1px solid #e5e7eb",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                {/* Video Container */}
                                <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000" }}>
                                    {isUpload && assetId ? (
                                        <HlsVideoPlayer
                                            key={assetId}
                                            /**
                                             * Shares the YouTube player's ref. HlsPlayerHandle
                                             * exposes the same seekTo/getCurrentTime/play/pause
                                             * surface, so the timestamp inputs, the Go to
                                             * Start/End buttons and the segment-bound
                                             * enforcement all work unchanged.
                                             */
                                            ref={playerRef}
                                            assetId={assetId}
                                            startTime={formatTime(range[0])}
                                            endTime={formatTime(range[1])}
                                            className="h-full w-full"
                                            onReady={seconds => {
                                                setDuration(seconds);
                                                // Unlocks the timestamp controls, which are
                                                // gated on a ready player.
                                                setPlayerReady(true);
                                            }}
                                        />
                                    ) : videoId ? (
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
                                    ) : (
                                        <video
                                            src={url}
                                            controls
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                background: "#000",
                                                borderRadius: "12px 12px 0 0",
                                                objectFit: "contain",
                                            }}
                                            onLoadedMetadata={(e) => {
                                                const target = e.target as HTMLVideoElement;
                                                setDuration(target.duration);
                                                setPlayerReady(true);
                                            }}
                                            onTimeUpdate={(e) => {
                                                const target = e.target as HTMLVideoElement;
                                                setCurrentTime(target.currentTime);
                                            }}
                                        />
                                    )}
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
                                        Start: {formatTime(range[0])} &nbsp; End: {formatTime(range[1])} &nbsp; Current: {formatTime(currentTime)}
                                    </div>
                                </div>
                                {/* Start/End Time Inputs Below Video */}
                                <div
                                    /*
                                      * No `user-select: none` here. It used to sit on this
                                      * container and, because it inherits, it was what stopped
                                      * a teacher selecting the text inside the timestamp
                                      * fields to overwrite it — the whole of issue #499.
                                      */
                                    style={{
                                        borderRadius: '0 0 12px 12px',
                                        flexShrink: 0,
                                    }}
                                    className="bg-muted border-t border-border p-4"
                                >
                                    <TimeRangePicker
                                        startSeconds={range[0]}
                                        endSeconds={range[1]}
                                        duration={duration}
                                        disabled={action === "view"}
                                        playerReady={playerReady}
                                        onChange={handleRangeChange}
                                        onValidityChange={setTimeRangeInvalid}
                                        onSeek={seconds => {
                                            if (playerRef.current && playerReady) {
                                                playerRef.current.seekTo(seconds, true);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="mt-4 p-4 bg-card border border-border rounded-lg">
                            <label className="block mb-2 font-medium text-sm text-foreground">Points</label>
                            <Input
                                type="number"
                                min={0}
                                value={points}
                                onChange={e => setPoints(Number(e.target.value))}
                                disabled={action === "view"}
                                style={{ width: 120 }}
                                className="bg-background border-border"
                            />
                        </div>
                        <div className="mt-4 p-4 bg-card border border-border rounded-lg flex items-center justify-between">
                            <div>
                                <Label htmlFor="enable-lens" className="font-semibold text-sm text-gray-700">
                                    Enable ViBe Lens AI Solver
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Allow students to take screenshots, sketch, and crop frame elements for real-time AI solutions.
                                </p>
                            </div>
                            <Switch
                                id="enable-lens"
                                checked={isLensEnabled}
                                onCheckedChange={setIsLensEnabled}
                                disabled={action === "view"}
                            />
                        </div>
                        {(action === "add" || action === "edit") && (
                            <div className="flex justify-end gap-2 mt-6">
                                <Button variant="outline" onClick={handleCancel} className="border-border">
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
                                    // An uploaded video has no URL and no YouTube
                                    // player, so those two gates only apply to the
                                    // link flow. It needs a ready asset instead.
                                    const isDisabled =
                                    (action !== "add" && !playerReady && !isUpload) ||
                                    (isUpload ? !assetId : !url) ||
                                    !name ||
                                    !description ||
                                    // Timestamp validity is TimeRangePicker's to judge.
                                    timeRangeInvalid;

                                    return (
                                        <Button
                                            onClick={handleSave}
                                            disabled={isDisabled}
                                            
                                            className="bg-primary hover:bg-primary/90"
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