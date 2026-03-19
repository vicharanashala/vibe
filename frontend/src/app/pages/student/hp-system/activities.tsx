import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentActivities, useSubmitActivity } from "@/hooks/hooks";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    FileText,
    Link as LinkIcon,
    Clock,
    ArrowLeft,
    Paperclip,
    Plus,
    Trash2,
    Loader2,
    Send,
    Image as ImageIcon,
    User
} from "lucide-react";
import { HpActivity } from "@/lib/api/hp-system";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination } from "@/components/ui/Pagination";

// Countdown timer component for deadline display
const DeadlineCountdown = ({ deadline, allowLate }: { deadline: string; allowLate: boolean }) => {
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; isExpired: boolean }>(() => {
        const now = new Date().getTime();
        const deadlineTime = new Date(deadline).getTime();
        const diff = deadlineTime - now;
        
        if (diff <= 0) {
            return { days: 0, hours: 0, minutes: 0, isExpired: true };
        }
        
        return {
            days: Math.floor(diff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            isExpired: false
        };
    });

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const deadlineTime = new Date(deadline).getTime();
            const diff = deadlineTime - now;

            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, isExpired: true });
                clearInterval(timer);
            } else {
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                    isExpired: false
                });
            }
        }, 60000); // Update every minute

        return () => clearInterval(timer);
    }, [deadline]);

    if (timeLeft.isExpired) {
        return (
            <span className={`font-medium ${allowLate ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                {allowLate ? 'Deadline passed (late submission allowed)' : 'Deadline passed'}
            </span>
        );
    }

    return (
        <span className="font-medium text-orange-600 dark:text-orange-400">
            {timeLeft.days > 0 && `${timeLeft.days}d `}
            {timeLeft.hours > 0 && `${timeLeft.hours}h `}
            {timeLeft.minutes}m left
        </span>
    );
};

export default function StudentActivities() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();

        const [currentPage, setCurrentPage] = useState(1);
        const itemsPerPage = 6;

    const { data: activities, isLoading, error, refetch } = useHpStudentActivities(
        courseVersionId as string,
        cohortName as string
    );

    const totalPages = Math.ceil((activities?.length || 0) / itemsPerPage);

    const { mutateAsync: submitActivity, isPending: isSubmitting } = useSubmitActivity();

    // Submit dialog state
    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<HpActivity | null>(null);
    const [textResponse, setTextResponse] = useState("");
    const [links, setLinks] = useState<{ url: string; label: string }[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [images, setImages] = useState<File[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);

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
                <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/student/hp-system/cohorts' })}>
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
                            onClick={() => navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/submissions` })}
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
                <div className="grid grid-cols-1 gap-6">
                    {activities.map((activity: HpActivity) => (
                        <Card key={activity._id} className="group relative overflow-hidden border-border/60 bg-card/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400/60 via-rose-400/60 to-sky-400/60" />
                            <CardHeader className="relative pb-3 pt-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="secondary" className="bg-secondary/60 text-secondary-foreground shadow-none">
                                                {getActivityTypeLabel(activity.activityType)}
                                            </Badge>
                                            <Badge variant="outline" className="bg-background/80">
                                                {activity.submissionMode === 'EXTERNAL_LINK' ? 'External Link' : 'In Platform'}
                                            </Badge>
                                            {activity.rules && (
                                                activity.rules.isMandatory ? (
                                                    <Badge className="border-red-600/70 bg-red-600 text-white">
                                                        Mandatory
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-background/80">
                                                        Optional
                                                    </Badge>
                                                )
                                            )}
                                        </div>
                                        <CardTitle className="text-xl tracking-tight">{activity.title}</CardTitle>
                                        <div className="space-y-1.5 text-xs text-muted-foreground">
                                            {activity.createdAt && (
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-4 w-4" />
                                                    <span>Created {formatDate(activity.createdAt)}</span>
                                                </div>
                                            )}
                                            {activity.instructorName && (
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-4 w-4" />
                                                    <span className="font-medium">Instructor:</span>
                                                    <span>{activity.instructorName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {activity.rules?.deadlineAt && (
                                        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                                            <div className="flex items-center gap-1.5 text-orange-600/90 dark:text-orange-400">
                                                <Clock className="h-4 w-4" />
                                                <span className="font-medium text-foreground">Deadline</span>
                                            </div>
                                            <div className="mt-1 text-sm font-medium text-foreground">
                                                {formatDate(activity.rules.deadlineAt.toString())}
                                            </div>
                                            <div className="mt-1 text-[11px]">
                                                <DeadlineCountdown
                                                    deadline={activity.rules.deadlineAt.toString()}
                                                    allowLate={activity.rules.allowLateSubmission ?? true}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-3">
                                <div>
                                    <h4 className="text-sm font-semibold mb-1">Description</h4>
                                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                                        {activity.description}
                                    </p>
                                </div>

                                {activity.attachments && activity.attachments.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            <Paperclip className="h-4 w-4" />
                                            Attachments
                                        </h4>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {activity.attachments.map((att, idx) => (
                                                <a
                                                    key={idx}
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
                                                >
                                                    {att.kind === 'LINK' ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                    {att.name}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activity.submissionMode === 'EXTERNAL_LINK' && activity.externalLink && (
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            <LinkIcon className="h-4 w-4" />
                                            External Link
                                        </h4>
                                        <a
                                            href={activity.externalLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-lg border border-blue-200/60 bg-blue-50/70 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                                        >
                                            <LinkIcon className="h-4 w-4" />
                                            {activity.externalLink}
                                        </a>
                                    </div>
                                )}
                            </CardContent>
                                <CardFooter className="border-t bg-muted/10 px-6 py-1">
                                    <div className="flex w-full items-center justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => navigate({
                                                to: `/student/hp-system/${courseVersionId}/${cohortName}/activities/${activity._id}`
                                            })}
                                        >
                                            View
                                        </Button>
                                    </div>
                            </CardFooter>
                        </Card>
                    ))}

                                {activities && activities.length > 0 && (
                                    <Card>
                                        <CardContent className="p-3">
                                            <Pagination
                                                currentPage={currentPage}
                                                totalPages={totalPages}
                                                totalDocuments={activities?.length || 0}
                                                onPageChange={setCurrentPage}
                                            />
                                        </CardContent>
                                    </Card>
                                )}

                </div>
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
