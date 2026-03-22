import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useRouterState } from "@tanstack/react-router";
import { useHpStudentActivities, useSubmitActivity } from "@/hooks/hooks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/Pagination";
import {
    FileText,
    Link as LinkIcon,
    ArrowLeft,
    Plus,
    Trash2,
    Loader2,
    Send,
    Image as ImageIcon,
    Search,
    Clock,
    Calendar,
    Flame
} from "lucide-react";
import { HpActivity } from "@/lib/api/hp-system";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Helper for character-count truncation
const truncateText = (text: string | null | undefined, maxLength: number = 70) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength).trim() + "..." : text;
};

// Countdown timer component for deadline display
const DeadlineCountdown = ({ deadline, allowLate }: { deadline: string; allowLate: boolean }) => {
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isExpired: boolean }>(() => {
        const now = new Date().getTime();
        const deadlineTime = new Date(deadline).getTime();
        const diff = deadlineTime - now;

        if (diff <= 0) {
            return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
        }

        return {
            days: Math.floor(diff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diff % (1000 * 60)) / 1000),
            isExpired: false
        };
    });

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const deadlineTime = new Date(deadline).getTime();
            const diff = deadlineTime - now;

            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
                clearInterval(timer);
            } else {
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((diff % (1000 * 60)) / 1000),
                    isExpired: false
                });
            }
        }, 1000); // Update every second

        return () => clearInterval(timer);
    }, [deadline]);

    if (timeLeft.isExpired) {
        return (
            <div className={`flex items-center gap-1.5 text-sm font-medium ${allowLate ? 'text-amber-600 dark:text-amber-500' : 'text-destructive'}`}>
                <Clock className="h-4 w-4" />
                <span>{allowLate ? 'Late Submission' : 'Deadline Passed'}</span>
            </div>
        );
    }

    const isUrgent = timeLeft.days === 0 && timeLeft.hours < 12;

    return (
        <div className={`flex items-center gap-1.5 text-sm font-medium ${isUrgent ? 'text-orange-600 dark:text-orange-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
            <Clock className="h-4 w-4" />
            <div className="flex items-baseline gap-1 font-mono tracking-tight">
                {timeLeft.days > 0 && <span>{timeLeft.days}d</span>}
                {timeLeft.hours > 0 && <span>{timeLeft.hours}h</span>}
                <span>{timeLeft.minutes}m</span>
                <span className="opacity-70">{timeLeft.seconds}s</span>
            </div>
            <span className="text-xs font-normal opacity-70">left</span>
        </div>
    );
};

export default function StudentActivities() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();

    const router = useRouterState();
    const from = router.location.state?.from;

    // Pagination and search state
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>([]);

    const { data: activities, isLoading, error, refetch } = useHpStudentActivities(
        courseVersionId as string,
        cohortName as string
    );
    const { mutateAsync: submitActivity, isPending: isSubmitting } = useSubmitActivity();

    // Submit dialog state
    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<HpActivity | null>(null);
    const [textResponse, setTextResponse] = useState("");
    const [links, setLinks] = useState<{ url: string; label: string }[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [images, setImages] = useState<File[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submissionFilter, setSubmissionFilter] = useState<"PENDING" | "ALL">("PENDING");

    const formatDate = (dateString: string) => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            }).format(new Date(dateString));
        } catch (e) {
            return dateString;
        }
    };

    const openSubmitDialog = (activity: HpActivity) => {
        setSelectedActivity(activity);
        setTextResponse("");
        setLinks([]);
        setFiles([]);
        setImages([]);
        setSubmitError(null);
        setSubmitDialogOpen(true);
    };

    const addLink = () => {
        setLinks([...links, { url: "", label: "" }]);
    };

    const updateLink = (index: number, field: 'url' | 'label', value: string) => {
        const updated = [...links];
        updated[index][field] = value;
        setLinks(updated);
    };

    const removeLink = (index: number) => {
        setLinks(links.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!selectedActivity) return;
        setSubmitError(null);

        const validLinks = links.filter(l => l.url.trim() !== "");
        const hasAttachments = files.length > 0 || images.length > 0 || validLinks.length > 0;
        const hasText = textResponse.trim() !== "";

        if (!hasText || !hasAttachments) {
            setSubmitError("Please provide a text response AND at least one attachment (file, image, or link).");
            return;
        }

        try {
            await submitActivity({
                courseId: selectedActivity.courseId,
                courseVersionId: selectedActivity.courseVersionId,
                cohort: selectedActivity.cohort,
                activityId: selectedActivity._id!,
                payload: {
                    textResponse: textResponse.trim() || undefined,
                    links: validLinks.length > 0 ? validLinks : undefined,
                },
                submissionSource: "IN_PLATFORM",
                files: files.length > 0 ? files : undefined,
                images: images.length > 0 ? images : undefined,
            });
            setSubmitDialogOpen(false);
            refetch(); // Refresh the activities list
        } catch (err: any) {
            setSubmitError(err.message || "Failed to submit activity");
        }
    };

    const getActivityTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            ASSIGNMENT: "Assignment",
            MILESTONE: "Milestone",
            EXTERNAL_IMPORT: "External Import",
            VIBE_MILESTONE: "ViBe Milestone",
            OTHER: "Other"
        };
        return labels[type] || type;
    };

    // Pagination logic
    const filteredActivities = useMemo(() => {
        if (!activities) return [];
        return activities.filter((activity: HpActivity) => {
            // Search by title only
            const matchesSearch = activity.title?.toLowerCase().includes(searchQuery.toLowerCase());

            // Filter by activity types
            const matchesType = selectedActivityTypes.length === 0 ||
                selectedActivityTypes.includes(activity.activityType);

            const isSubmitted = activity.isSubmitted === true;
            const matchesSubmission = submissionFilter === "ALL" || !isSubmitted;

            return matchesSearch && matchesType && matchesSubmission;
        });
    }, [activities, searchQuery, selectedActivityTypes, submissionFilter]);

    const paginatedActivities = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredActivities.slice(startIndex, endIndex);
    }, [filteredActivities, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);

    // Get unique activity types for filter options
    const activityTypes = useMemo(() => {
        if (!activities) return [];
        const types = [...new Set(activities.map((a: HpActivity) => a.activityType).filter(Boolean))];
        return types.sort();
    }, [activities]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1); // Reset to first page when searching
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page when changing items per page
    };

    const handleActivityTypeToggle = (type: string) => {
        setSelectedActivityTypes(prev => {
            if (prev.includes(type)) {
                return prev.filter(t => t !== type);
            } else {
                return [...prev, type];
            }
        });
        setCurrentPage(1); // Reset to first page when filtering
    };

    if (isLoading) {
        return (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading activities...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500">
                Error: {error}
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="container mx-auto p-6 max-w-5xl space-y-6">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate({ to: from || '/student/hp-system/cohorts' })}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
                        <p className="text-muted-foreground">
                            {decodeURIComponent(cohortName as string)}
                        </p>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                onClick={() => navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/submissions`, state: { from } })}
                            >
                                View My Submissions
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>View all your submitted activities and their status</TooltipContent>
                    </Tooltip>
                </div>

                {(!activities || activities.length === 0) ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium">No Activities Yet</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                            There are no activities published for this cohort at the moment.
                        </p>
                    </Card>
                ) : (
                    <>
                        {/* Search and Filter Controls */}
                        <div className="flex flex-col gap-4 mb-6">
                            {/* Search Bar */}
                            <div className="relative w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by activity title..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {/* Filters Row */}
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Activity Type Filter */}
                                <Select
                                    value={selectedActivityTypes.length === 1 ? selectedActivityTypes[0] : "ALL"}
                                    onValueChange={(v) => {
                                        setSelectedActivityTypes(v === "ALL" ? [] : [v]);
                                        setCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Activity Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Types</SelectItem>
                                        {activityTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {getActivityTypeLabel(type)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Submission Filter */}
                                <Select
                                    value={submissionFilter}
                                    onValueChange={(v) => setSubmissionFilter(v as "PENDING" | "ALL")}
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Submissions" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PENDING">Pending Only</SelectItem>
                                        <SelectItem value="ALL">All (incl. submitted)</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Items Per Page */}
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-sm text-muted-foreground">Show:</span>
                                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                                        <SelectTrigger className="w-[80px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5</SelectItem>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="15">15</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="30">30</SelectItem>
                                            <SelectItem value="40">40</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {paginatedActivities.map((activity: HpActivity) => (
                                <Card
                                    key={activity._id}
                                    className="group relative overflow-hidden rounded-xl border bg-card p-0 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                                >
                                    <div className="flex items-center justify-between gap-6 px-6 py-5">
                                        {/* Left: Info */}
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-base" title={activity.title}>
                                                    {truncateText(activity.title, 70)}
                                                </span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {getActivityTypeLabel(activity.activityType)}
                                                </Badge>
                                                {activity.isSubmitted && (
                                                    <Badge variant="default" className="text-xs">Submitted</Badge>
                                                )}
                                            </div>
                                            {activity.description && (
                                                <p className="text-sm text-muted-foreground" title={activity.description}>
                                                    {truncateText(activity.description, 85)}
                                                </p>
                                            )}
                                            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/50">
                                                {activity.createdAt && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Calendar className="h-3.5 w-3.5 opacity-70" />
                                                        <span>
                                                            <span className="font-medium text-foreground/80">Created:</span>{" "}
                                                            {formatDate(activity.createdAt)}
                                                        </span>
                                                    </div>
                                                )}
                                                {activity.rules?.deadlineAt && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Clock className="h-3.5 w-3.5 opacity-70 text-orange-500" />
                                                        <span>
                                                            <span className="font-medium text-foreground/80">Deadline:</span>{" "}
                                                            <span className="text-foreground font-medium">{formatDate(activity.rules.deadlineAt.toString())}</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Countdown + View */}
                                        <div className="flex items-center gap-4 shrink-0">
                                            {activity.rules?.deadlineAt && (
                                                <div className="text-sm font-semibold">
                                                    <DeadlineCountdown
                                                        deadline={activity.rules.deadlineAt.toString()}
                                                        allowLate={activity.rules.allowLateSubmission ?? true}
                                                    />
                                                </div>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    navigate({
                                                        to: `/student/hp-system/${courseVersionId}/${cohortName}/activities/${activity._id}`,
                                                        state: { from }
                                                    })
                                                }
                                            >
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Pagination Component */}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalDocuments={filteredActivities.length}
                            onPageChange={setCurrentPage}
                        />
                    </>
                )}

                {/* Submit Activity Dialog */}
                <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Submit Activity</DialogTitle>
                            <DialogDescription>
                                {selectedActivity?.title}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            {/* Text Response */}
                            <div className="space-y-2">
                                <Label htmlFor="textResponse">Your Response</Label>
                                <textarea
                                    id="textResponse"
                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Write your response here..."
                                    value={textResponse}
                                    onChange={(e) => setTextResponse(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* File Uploads */}
                            <div className="space-y-3">
                                <Label>Files (PDF, DOCX, etc)</Label>
                                <Input
                                    type="file"
                                    multiple
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            setFiles((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
                                        }
                                    }}
                                    disabled={isSubmitting}
                                />
                                {files.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded border">
                                                <div className="flex items-center gap-2 truncate">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate">{file.name}</span>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => setFiles(files.filter((_, i) => i !== idx))}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Image Uploads */}
                            <div className="space-y-3">
                                <Label>Images (JPG, PNG)</Label>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            setImages((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
                                        }
                                    }}
                                    disabled={isSubmitting}
                                />
                                {images.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                        {images.map((img, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded border">
                                                <div className="flex items-center gap-2 truncate">
                                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate">{img.name}</span>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => setImages(images.filter((_, i) => i !== idx))}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Links */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Links</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addLink}
                                        disabled={isSubmitting}
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Link
                                    </Button>
                                </div>
                                {links.map((link, index) => (
                                    <div key={index} className="flex gap-2 items-start">
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                placeholder="URL (e.g. https://github.com/...)"
                                                value={link.url}
                                                onChange={(e) => updateLink(index, 'url', e.target.value)}
                                                disabled={isSubmitting}
                                            />
                                            <Input
                                                placeholder="Label (e.g. GitHub Repository)"
                                                value={link.label}
                                                onChange={(e) => updateLink(index, 'label', e.target.value)}
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeLink(index)}
                                            disabled={isSubmitting}
                                            className="mt-1 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {links.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No links added yet.</p>
                                )}
                            </div>

                            {submitError && (
                                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                                    {submitError}
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !textResponse.trim() || (files.length === 0 && images.length === 0 && links.every(l => !l.url.trim())) || (selectedActivity?.rules?.deadlineAt && new Date().getTime() > new Date(selectedActivity.rules.deadlineAt.toString()).getTime() && !(selectedActivity?.rules?.allowLateSubmission ?? true))}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Submitting...
                                    </>
                                ) : (selectedActivity?.rules?.deadlineAt && new Date().getTime() > new Date(selectedActivity.rules.deadlineAt.toString()).getTime() && !(selectedActivity?.rules?.allowLateSubmission ?? true)) ? (
                                    <>
                                        <Clock className="h-4 w-4 mr-2" />
                                        Deadline Passed
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Submit
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}
