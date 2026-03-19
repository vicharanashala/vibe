import { useState } from "react";
import { useParams, useNavigate, useRouterState } from "@tanstack/react-router";
import { useHpStudentActivities, useSubmitActivity, useHpRuleConfig } from "@/hooks/hooks";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    FileText, Link as LinkIcon, Clock, ArrowLeft,
    Paperclip, Plus, Trash2, Loader2, Send, Image as ImageIcon, User
} from "lucide-react";
import { HpActivity } from "@/lib/api/hp-system";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function StudentActivityDetail() {
    const { courseVersionId, cohortName, activityId } = useParams({ strict: false });
    const navigate = useNavigate();
    const router=useRouterState();
    const from = router.location.state?.from;

    const { data: activities, isLoading, error, refetch } = useHpStudentActivities(
        courseVersionId as string,
        cohortName as string
    );
    const { mutateAsync: submitActivity, isPending: isSubmitting } = useSubmitActivity();

    const activity = activities?.find((a: HpActivity) => a._id === activityId);
    const { data: ruleConfig } = useHpRuleConfig(activity?._id);

    // Submit dialog state
    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
    const [textResponse, setTextResponse] = useState("");
    const [links, setLinks] = useState<{ url: string; label: string }[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [images, setImages] = useState<File[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const formatDate = (dateString: string) => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: 'numeric', hour12: true
            }).format(new Date(dateString));
        } catch (e) {
            return dateString;
        }
    };

    const getActivityTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            ASSIGNMENT: "Assignment", MILESTONE: "Milestone",
            EXTERNAL_IMPORT: "External Import", VIBE_MILESTONE: "ViBe Milestone", OTHER: "Other"
        };
        return labels[type] || type;
    };

    const addLink = () => setLinks([...links, { url: "", label: "" }]);

    const updateLink = (index: number, field: 'url' | 'label', value: string) => {
        const updated = [...links];
        updated[index][field] = value;
        setLinks(updated);
    };

    const removeLink = (index: number) => setLinks(links.filter((_, i) => i !== index));

    const handleSubmit = async () => {
        if (!activity) return;
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
                courseId: activity.courseId,
                courseVersionId: activity.courseVersionId,
                cohort: activity.cohort,
                activityId: activity._id!,
                payload: {
                    textResponse: textResponse.trim() || undefined,
                    links: validLinks.length > 0 ? validLinks : undefined,
                },
                submissionSource: "IN_PLATFORM",
                files: files.length > 0 ? files : undefined,
                images: images.length > 0 ? images : undefined,
            } as any);
            setSubmitDialogOpen(false);
            refetch();
            navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/activities`,state:{from} });
        } catch (err: any) {
            setSubmitError(err.message || "Failed to submit activity");
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading activity...
            </div>
        );
    }


    if (error || !activity) {
        return (
            <div className="p-8 text-center text-red-500">
                Activity not found.
            </div>
        );
    }

    const now = new Date().getTime();
    const deadlineTime = activity.rules?.deadlineAt ? new Date(activity.rules.deadlineAt.toString()).getTime() : null;
    const isExpired = deadlineTime ? now > deadlineTime : false;
    const allowLate = activity.rules?.allowLateSubmission ?? true;
    const canSubmit = !isExpired || allowLate;

    return (
        <TooltipProvider>
            <div className="container mx-auto p-6 max-w-7xl space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/activities` , state:{from}})}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight">{activity.title}</h1>
                        <p className="text-muted-foreground text-sm">{decodeURIComponent(cohortName as string)}</p>
                    </div>
                </div>

                {/* Activity Details Card */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="secondary">{getActivityTypeLabel(activity.activityType)}</Badge>
                            <Badge variant="outline">{activity.submissionMode === 'EXTERNAL_LINK' ? 'External Link' : 'In Platform'}</Badge>
                            {activity.rules?.isMandatory ? (
                                <Badge className="bg-red-600 text-white">Mandatory</Badge>
                            ) : (
                                <Badge variant="outline">Optional</Badge>
                            )}
                        </div>
                        <CardTitle className="text-xl">{activity.title}</CardTitle>
                        <div className="space-y-1 text-xs text-muted-foreground mt-2">
                            {activity.createdAt && (
                                <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Created {formatDate(activity.createdAt)}</span>
                                </div>
                            )}
                            {activity.instructorName && (
                                <div className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5" />
                                    <span>Instructor: {activity.instructorName}</span>
                                </div>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Deadline */}
                        {activity.rules?.deadlineAt && (
                            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                                <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-medium mb-1">
                                    <Clock className="h-4 w-4" />
                                    Deadline
                                </div>
                                <div className="font-medium">{formatDate(activity.rules.deadlineAt.toString())}</div>
                                {isExpired ? (
                                    <div className={`text-xs mt-1 ${allowLate ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {allowLate ? 'Deadline passed (late submission allowed)' : 'Deadline passed'}
                                    </div>
                                ) : (
                                    <div className="text-xs text-green-600 mt-1">Submission open</div>
                                )}
                            </div>
                        )}

                        {/* Rules */}
                        <div className="space-y-5">
                            <h4 className="text-base font-semibold">Rules & Configuration</h4>

                            {/* Basic Rules */}
                            <div className="flex flex-wrap gap-3 text-sm">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-muted/30">
                                    <span className="text-muted-foreground">Mandatory:</span>
                                    <span className="font-medium">{activity.rules?.isMandatory ? 'Yes' : 'No'}</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-muted/30">
                                    <span className="text-muted-foreground">Late Submission:</span>
                                    <span className="font-medium">{activity.rules?.allowLateSubmission ? 'Allowed' : 'Not Allowed'}</span>
                                </div>
                                {ruleConfig?.lateRewardPolicy && (
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-muted/30">
                                        <span className="text-muted-foreground">Late Reward Policy:</span>
                                        <span className="font-medium">{ruleConfig.lateRewardPolicy.replace('_', ' ')}</span>
                                    </div>
                                )}
                            </div>

                            {/* Reward Config */}
                            {ruleConfig?.reward?.enabled && (
                                <div className="rounded-xl border bg-green-500/5 border-green-500/20 p-6 space-y-2">
                                    <h5 className="text-sm font-semibold text-green-600">🏆 Reward</h5>
                                    <div className="flex flex-wrap gap-10 text-sm">
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">HP Points</div>
                                            <div className="font-bold text-green-600 text-2xl">{ruleConfig.reward.value} {ruleConfig.reward.type === 'PERCENTAGE' ? '%' : 'pts'}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Reward Type</div>
                                            <div className="font-medium text-base">{ruleConfig.reward.type}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Apply When</div>
                                            <div className="font-medium text-base">{ruleConfig.reward.applyWhen.replace('_', ' ')}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Only Within Deadline</div>
                                            <div className="font-medium text-base">{ruleConfig.reward.onlyWithinDeadline ? 'Yes' : 'No'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Penalty Config */}
                            {ruleConfig?.penalty?.enabled && (
                                <div className="rounded-xl border bg-red-500/5 border-red-500/20 p-6 space-y-2">
                                    <h5 className="text-sm font-semibold text-red-600">⚠️ Penalty</h5>
                                    <div className="flex flex-wrap gap-10 text-sm">
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Penalty Value</div>
                                            <div className="font-bold text-red-600 text-2xl">{ruleConfig.penalty.value} {ruleConfig.penalty.type === 'PERCENTAGE' ? '%' : 'pts'}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Penalty Type</div>
                                            <div className="font-medium text-base">{ruleConfig.penalty.type}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Grace Period</div>
                                            <div className="font-medium text-base">{ruleConfig.penalty.graceMinutes} mins</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* HP Limits */}
                            {ruleConfig?.limits && (
                                <div className="flex gap-10 text-sm">
                                    <div>
                                        <div className="text-muted-foreground text-xs mb-1">Min HP</div>
                                        <div className="font-medium text-base">{ruleConfig.limits.minHp}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground text-xs mb-1">Max HP</div>
                                        <div className="font-medium text-base">{ruleConfig.limits.maxHp}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Description</h4>
                            <p className="text-muted-foreground text-sm whitespace-pre-wrap">{activity.description}</p>
                        </div>

                        {/* Attachments */}
                        {activity.attachments && activity.attachments.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Paperclip className="h-4 w-4" /> Attachments
                                </h4>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {activity.attachments.map((att, idx) => (
                                        <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-sm transition-colors hover:bg-muted/60">
                                            {att.kind === 'LINK' ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                            {att.name}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* External Link */}
                        {activity.submissionMode === 'EXTERNAL_LINK' && activity.externalLink && (
                            <div>
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <LinkIcon className="h-4 w-4" /> External Link
                                </h4>
                                <a href={activity.externalLink} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200/60 bg-blue-50/70 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-400">
                                    <LinkIcon className="h-4 w-4" />
                                    {activity.externalLink}
                                </a>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="border-t bg-muted/10 px-6 py-4">
                        <div className="flex w-full items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground">
                                {isExpired && !allowLate ? "Submission closed" : "Ready to submit"}
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={() => setSubmitDialogOpen(true)}
                                        disabled={!canSubmit}
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {isExpired && !allowLate ? 'Deadline Passed' : 'Submit'}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Submit your work for this activity to earn HP points</TooltipContent>
                            </Tooltip>
                        </div>
                    </CardFooter>
                </Card>

                {/* Submit Dialog */}
                <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
                    <DialogContent className="w-[75vw] max-w-none">                    
                        <DialogHeader>
                        <DialogTitle>Submit Activity</DialogTitle>
                        <DialogDescription>{activity.title}</DialogDescription>
                    </DialogHeader>

                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="textResponse">Your Response</Label>
                                <textarea
                                    id="textResponse"
                                    className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Write your response here..."
                                    value={textResponse}
                                    onChange={(e) => setTextResponse(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="space-y-3">
                                <Label>Files (PDF, DOCX, etc)</Label>
                                <Input type="file" multiple onChange={(e) => {
                                    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
                                }} disabled={isSubmitting} />
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded border">
                                        <div className="flex items-center gap-2 truncate">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="truncate">{file.name}</span>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setFiles(files.filter((_, i) => i !== idx))}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <Label>Images (JPG, PNG)</Label>
                                <Input type="file" accept="image/*" multiple onChange={(e) => {
                                    if (e.target.files) setImages((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
                                }} disabled={isSubmitting} />
                                {images.map((img, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded border">
                                        <div className="flex items-center gap-2 truncate">
                                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="truncate">{img.name}</span>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setImages(images.filter((_, i) => i !== idx))}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Links</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addLink} disabled={isSubmitting}>
                                        <Plus className="h-4 w-4 mr-1" /> Add Link
                                    </Button>
                                </div>
                                {links.map((link, index) => (
                                    <div key={index} className="flex gap-2 items-start">
                                        <div className="flex-1 space-y-2">
                                            <Input placeholder="URL (e.g. https://github.com/...)" value={link.url} onChange={(e) => updateLink(index, 'url', e.target.value)} disabled={isSubmitting} />
                                            <Input placeholder="Label (e.g. GitHub Repository)" value={link.label} onChange={(e) => updateLink(index, 'label', e.target.value)} disabled={isSubmitting} />
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(index)} disabled={isSubmitting} className="mt-1 text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {links.length === 0 && <p className="text-sm text-muted-foreground">No links added yet.</p>}
                            </div>

                            {submitError && (
                                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">{submitError}</div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !textResponse.trim() || (files.length === 0 && images.length === 0 && links.every(l => !l.url.trim()))}
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
                                ) : (
                                    <><Send className="h-4 w-4 mr-2" />Submit</>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}