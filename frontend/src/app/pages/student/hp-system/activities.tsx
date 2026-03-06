import { useState } from "react";
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
    Image as ImageIcon
} from "lucide-react";
import { HpActivity } from "@/lib/api/hp-system";

export default function StudentActivities() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();

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
                <Button
                    variant="outline"
                    onClick={() => navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/submissions` })}
                >
                    View My Submissions
                </Button>
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
                        <Card key={activity._id} className="overflow-hidden">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1.5 flex-grow">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="bg-background">
                                                {getActivityTypeLabel(activity.activityType)}
                                            </Badge>
                                            <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground shadow-none">
                                                {activity.submissionMode === 'EXTERNAL_LINK' ? 'External Link' : 'In Platform'}
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-xl">{activity.title}</CardTitle>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                                            {activity.createdAt && (
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-4 w-4" />
                                                    <span>Created: {formatDate(activity.createdAt)}</span>
                                                </div>
                                            )}
                                            {activity.instructorName && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium">Instructor:</span>
                                                    <span>{activity.instructorName}</span>
                                                </div>
                                            )}
                                            {activity.rules && (
                                                <>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium">Mandatory:</span>
                                                        <span>{activity.rules.isMandatory ? 'Yes' : 'No'}</span>
                                                    </div>
                                                    {activity.rules.deadlineAt && (
                                                        <div className="flex items-center gap-1.5 text-orange-600/90 dark:text-orange-400">
                                                            <span className="font-medium">Deadline:</span>
                                                            <span>{formatDate(activity.rules.deadlineAt.toString())}</span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div>
                                    <h4 className="text-sm font-semibold mb-2">Description</h4>
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
                                        <div className="flex flex-wrap gap-2">
                                            {activity.attachments.map((att, idx) => (
                                                <a
                                                    key={idx}
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm border transition-colors"
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
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 text-sm border border-blue-200 dark:border-blue-800 transition-colors"
                                        >
                                            <LinkIcon className="h-4 w-4" />
                                            {activity.externalLink}
                                        </a>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t justify-center gap-2  px-6 py-4">

                                <Button>edit</Button>

                                <Button onClick={() => openSubmitDialog(activity)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Submit
                                </Button>

                            </CardFooter>
                        </Card>
                    ))}
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
                            disabled={isSubmitting || !textResponse.trim() || (files.length === 0 && images.length === 0 && links.every(l => !l.url.trim()))}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Submitting...
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
    );
}
