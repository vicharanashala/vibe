import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentSubmissions, useHpStudents, useRevertHpEntry, useRestoreHpEntry, useReviewSubmission, useAddFeedback, useHpStudentStats } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    ArrowLeft, ExternalLink, Clock, FileText, CheckCircle, AlertCircle, XCircle,
    Image as ImageIcon, File, Link2, MessageSquare, CalendarClock, RotateCcw,
    Timer, Send, Zap, Undo2, ThumbsUp, ThumbsDown, ChevronDown,
    ChevronUp,
    Mail,
    User
} from "lucide-react";
import type { SubmissionAttachment, HpStudentSubmission } from "@/lib/api/hp-system";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const statusConfig = {
    SUBMITTED: { label: "Submitted", variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
    PENDING: { label: "Pending", variant: "secondary" as const, icon: Clock, color: "text-yellow-600" },
    REVERTED: { label: "Reverted", variant: "destructive" as const, icon: XCircle, color: "text-red-600" },
    APPROVED: { label: "Approved", variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
    REJECTED: { label: "Rejected", variant: "destructive" as const, icon: XCircle, color: "text-red-600" },
};

function formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function AttachmentIcon({ type }: { type: SubmissionAttachment['type'] }) {
    switch (type) {
        case 'image': return <ImageIcon className="h-4 w-4 text-blue-500" />;
        case 'pdf': return <File className="h-4 w-4 text-red-500" />;
        case 'document': return <FileText className="h-4 w-4 text-indigo-500" />;
        case 'link': return <Link2 className="h-4 w-4 text-purple-500" />;
        default: return <File className="h-4 w-4 text-muted-foreground" />;
    }
}

function AttachmentPreview({ attachment }: { attachment: SubmissionAttachment }) {
    if (attachment.type === 'image') {
        return (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block group">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                    <img src={attachment.url} alt={attachment.name || 'Image'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[80px]">{attachment.name}</p>
            </a>
        );
    }
    return (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors group max-w-[220px]"
        >
            <AttachmentIcon type={attachment.type} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{attachment.name || attachment.url}</p>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        </a>
    );
}

function FeedbackSection({ sub }: { sub: HpStudentSubmission }) {
    const [feedbackText, setFeedbackText] = useState("");
    const [showInput, setShowInput] = useState(false);
    const { mutateAsync: addFeedback, isPending } = useAddFeedback();

    const handleSubmitFeedback = async () => {
        if (!feedbackText.trim() || feedbackText.trim().length < 10) {
            toast.error('Feedback must be at least 10 characters long');
            return;
        }
        try {
            await addFeedback({ submissionId: sub.submission?._id || '', feedback: feedbackText.trim() });
            setFeedbackText("");
            setShowInput(false);
        } catch (error) {
            // Error is handled by the hook
        }
    };

    return (
        <TooltipProvider>
            <div className="space-y-3">
                {/* Instructor Feedback */}
                {sub.instructorFeedback && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Instructor Feedback
                            </div>
                            <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                                {String((sub.instructorFeedback as any)?.decision || "Reviewed")}
                            </span>
                        </div>

                        {(sub.instructorFeedback as any)?.reviewerName && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <User className="h-3 w-3" />
                                    {(sub.instructorFeedback as any).reviewerName}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Mail className="h-3 w-3" />
                                    {(sub.instructorFeedback as any).reviewerEmail}
                                </div>
                            </div>
                        )}

                        {(sub.instructorFeedback as any)?.reviewedAt && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date((sub.instructorFeedback as any).reviewedAt).toLocaleString("en-IN")}
                            </div>
                        )}

                        <p className="text-sm text-foreground/80 leading-relaxed border-t pt-2">
                            {String((sub.instructorFeedback as any)?.note || "No note provided")}
                        </p>
                    </div>
                )}

                {/* Feedback Controls */}
                <div className="flex items-center gap-2">
                    {/* Add Feedback Button */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowInput(true)}
                                className="flex items-center gap-2"
                            >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span className="text-xs">{sub.instructorFeedback ? "Update Feedback" : "Add Feedback"}</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add or update feedback for this student's submission</TooltipContent>
                    </Tooltip>

                    {/* View All Feedbacks */}
                    {sub.feedbacks && sub.feedbacks.length > 0 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        const panel = document.getElementById(`feedback-panel-${sub.submission?._id}`);
                                        panel?.classList.toggle('hidden');
                                    }}
                                    className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded border"
                                >
                                    {sub.feedbacks && sub.feedbacks.length > 0 && (
                                        <div className="">
                                            {sub.feedbacks.length} Feedback{sub.feedbacks.length !== 1 ? 's' : ''}
                                        </div>
                                    )}
                                    <ChevronDown className={`h-3 w-3 transition-transform ${document.getElementById(`feedback-panel-${sub.submission?._id}`)?.classList.contains('hidden') ? '' : 'rotate-180'}`} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>View all feedback given for this submission</TooltipContent>
                        </Tooltip>
                    )}
                </div>

                {/* Feedback Panel */}
                {sub.feedbacks && sub.feedbacks.length > 0 && (
                    <div
                        id={`feedback-panel-${sub.submission?._id}`}
                        className="hidden bg-muted/20 rounded-lg border p-2"
                    >
                        <div className="space-y-2">
                            {sub.feedbacks.map((feedback: any, idx: number) => (
                                <div key={idx} className="bg-background rounded border p-2">
                                    <p className="text-sm leading-relaxed">{feedback.feedback}</p>
                                    {feedback.feedbackAt && (
                                        <div className="text-xs text-muted-foreground mt-2">
                                            {new Date(feedback.feedbackAt).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add Feedback Input */}
                {showInput && (
                    <div className="space-y-3 bg-muted/20 rounded-lg border p-4">
                        <Textarea
                            placeholder="Write feedback for this submission..."
                            value={feedbackText}
                            onChange={e => setFeedbackText(e.target.value)}
                            rows={3}
                            className="resize-none bg-background"
                        />
                        <div className="flex items-center gap-2 justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setShowInput(false); setFeedbackText(""); }}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!feedbackText.trim() || feedbackText.trim().length < 10 || isPending}
                                onClick={handleSubmitFeedback}
                                className="flex items-center gap-2"
                            >
                                {isPending ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                                ) : (
                                    <Send className="h-3.5 w-3.5" />
                                )}
                                {isPending ? "Sending..." : "Send Feedback"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}

export default function StudentSubmissionsPage() {
    const { courseVersionId, cohortName, studentId } = useParams({ strict: false });
    const navigate = useNavigate();
    const { data: submissions, isLoading: submissionsLoading, error } = useHpStudentSubmissions(
        studentId || "", courseVersionId || "", cohortName || ""
    );

    const { data: submissionsStats, isLoading: submissionsStatsLoading, submissionsStatsError } = useHpStudentStats(studentId || "", cohortName || "");
    console.log("Fetched student stats:", submissionsStats, "Loading:", submissionsStatsLoading, "Error:", submissionsStatsError);
    // console.log("Fetched student submissions:", submissions, "Loading:", submissionsLoading, "Error:", error);

    const { data: students, isLoading: studentsLoading } = useHpStudents(courseVersionId || "", cohortName || "");
    const student = students.find(s => s._id === studentId);

    const { mutateAsync: revertEntry, isPending: isReverting } = useRevertHpEntry();
    const { mutateAsync: restoreEntry, isPending: isRestoring } = useRestoreHpEntry();
    const { mutateAsync: reviewSubmission, isPending: isReviewing } = useReviewSubmission();

    const [actionSubId, setActionSubId] = useState<string | null>(null);
    const [reasonDialog, setReasonDialog] = useState<{
        open: boolean;
        subId: string;
        action: 'revert' | 'restore' | 'approve' | 'reject';
        activityTitle: string;
        baseHp: number;
        note: string;
        pointsToDeduct: number;
    }>({ open: false, subId: '', action: 'revert', activityTitle: '', baseHp: 0, note: '', pointsToDeduct: 0 });

    const openReasonDialog = (subId: string, action: 'revert' | 'restore' | 'approve' | 'reject', activityTitle: string, baseHp: number = 0) => {
        const displayTitle = activityTitle && !isNaN(Number(activityTitle))
            ? `Activity ${activityTitle}`
            : activityTitle || 'Activity';
        setReasonDialog({ open: true, subId, action, activityTitle: displayTitle, baseHp, note: '', pointsToDeduct: baseHp });
    };

    const handleConfirmAction = async () => {
        const { subId, action, note, pointsToDeduct } = reasonDialog;
        setReasonDialog({ ...reasonDialog, open: false });
        setActionSubId(subId);
        try {
            if (action === 'restore') {
                await restoreEntry(subId);
            } else if (action === 'approve' || action === 'reject' || action === 'revert') {
                await reviewSubmission({
                    submissionId: subId,
                    decision: action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'REVERTED',
                    note: note.trim() || undefined,
                    pointsToDeduct: action === 'reject' ? pointsToDeduct : undefined
                });
            }
        } finally {
            setActionSubId(null);
        }
    };



    if (error) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>{String(error)}</span>
            </div>
        );
    }



    const safeSubmissions = submissions ?? [];
    // const totalActivities = safeSubmissions.length;
    // const submitted = safeSubmissions.filter((s: any) => s.submission?.status === "SUBMITTED").length;
    // const pending = safeSubmissions.filter((s: any) => s.submission?.status === "PENDING").length;
    // const late = safeSubmissions.filter((s: any) => s.submission?.isLate).length;
    // const totalCurrentHp = safeSubmissions.reduce((sum: number, s: any) => sum + (s.hp?.currentHp || 0), 0);
    const totalBaseHp = safeSubmissions.reduce((sum: number, s: any) => sum + (s.hp?.baseHp || 0), 0);
    return (
        <TooltipProvider>
            <div className="space-y-6 w-full pb-12">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate({
                            to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || "")}/activities`
                        })}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            {student?.name || "Student"} — Submissions
                        </h2>
                        <p className="text-muted-foreground">
                            {student?.email || ""} · {decodeURIComponent(cohortName || "")}
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                {studentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Activities</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                    {submissionsStats?.totalActivities}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Submitted</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    {submissionsStats?.totalSubmissions}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Pending</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-600 flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    {submissionsStats?.totalPendings}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Late Submissions</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                                    <Timer className="h-5 w-5" />
                                    {submissionsStats.totalLateSubmissions}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Current HP</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-yellow-500" />
                                    {submissionsStats.currentHp}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Base HP</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-muted-foreground flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-yellow-500" />
                                    {totalBaseHp}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Submission Cards */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Activity Submissions</h3>
                    {submissionsLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : safeSubmissions.length === 0 ? (
                        <div className="text-center py-12 border border-dashed rounded-lg">
                            <div className="text-muted-foreground">No submissions found for this student.</div>
                        </div>
                    ) : safeSubmissions.map((sub: any) => {
                        const status = sub.submission?.status || 'PENDING';
                        const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
                        const StatusIcon = cfg.icon;
                        const attachments = [
                            ...(sub.submission?.attachments?.files || []).map((f: any) => ({ ...f, type: 'document' })),
                            ...(sub.submission?.attachments?.images || []).map((i: any) => ({ ...i, type: 'image' }))
                        ];
                        const links = sub.submission?.attachments?.links || [];

                        return (
                            <Card key={sub.submission?._id || sub.activity?.id} className={`border-l-4 ${status === 'SUBMITTED' ? 'border-l-green-500' : status === 'REVERTED' ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-base">{sub.activity?.title || "Unknown Activity"}</CardTitle>
                                            {sub.activity?.description && (
                                                <p className="text-sm text-muted-foreground mt-1">{sub.activity.description}</p>
                                            )}
                                            <CardDescription className="flex flex-wrap items-center gap-3 mt-1.5">
                                                {sub.deadline && (
                                                    <span className="flex items-center gap-1 text-xs">
                                                        <CalendarClock className="h-3 w-3" />
                                                        Due: {formatDate(sub.deadline)}
                                                    </span>
                                                )}
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {/* HP badges */}
                                            {/* HP badges - show waiting for review for unapproved submissions */}
                                            {status === 'SUBMITTED' ? (
                                                <Badge variant="outline" className="text-sm font-semibold text-yellow-600">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    In Review
                                                </Badge>
                                            ) : (
                                                <>
                                                    <Badge variant="outline" className="text-sm font-semibold text-green-600">
                                                        <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                                                        {sub.hp?.currentHp || 0} HP
                                                    </Badge>
                                                    <Badge variant="outline" className="text-sm text-muted-foreground">
                                                        Base: {sub.hp?.baseHp || 0}
                                                    </Badge>
                                                </>
                                            )}
                                            {sub.submission?.isLate && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/20 cursor-default">
                                                            <Timer className="h-3 w-3 mr-1" />
                                                            Late
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>This submission was submitted after the deadline</TooltipContent>
                                                </Tooltip>
                                            )}
                                            <Badge variant={cfg.variant} className="flex items-center gap-1">
                                                <StatusIcon className="h-3 w-3" />
                                                {cfg.label}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Submission Timestamps */}
                                    {sub.submission?.submittedAt && (
                                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5" />
                                                Submitted: {formatDate(sub.submission.submittedAt)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Text response */}
                                    {sub.submission?.attachments?.textResponse && (
                                        <div className="mt-2 p-3 bg-muted/30 rounded border text-sm whitespace-pre-wrap">
                                            {sub.submission.attachments.textResponse}
                                        </div>
                                    )}

                                    {/* Links */}
                                    {links.length > 0 && (
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Links</p>
                                            <div className="flex flex-col gap-1">
                                                {links.map((link: any, idx: number) => (
                                                    <a
                                                        key={idx}
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                                                    >
                                                        <Link2 className="h-3.5 w-3.5" />
                                                        {link.label || link.url}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Attachments */}
                                    {attachments.length > 0 && (
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                                Attachments ({attachments.length})
                                            </p>
                                            <div className="flex flex-wrap gap-3">
                                                {attachments.map((att: any, idx: number) => (
                                                    <AttachmentPreview key={idx} attachment={att} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Instructor Feedback + Revert/Restore Actions */}
                                    {status !== 'PENDING' && (
                                        <>
                                            <Separator />
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <FeedbackSection sub={sub} />
                                                </div>
                                                <div className="flex-shrink-0 pt-1">
                                                    {status === 'SUBMITTED' && (
                                                        <div className="flex gap-2">
                                                            {sub.isRequiredInstructorApproval && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                    disabled={isReviewing && actionSubId === sub.submission?._id}
                                                                    onClick={() => openReasonDialog(sub.submission?._id || '', 'approve', sub.activity?.title || '', sub.hp?.baseHp || 0)}
                                                                >
                                                                    <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                                                                    {isReviewing && actionSubId === sub.submission?._id ? 'Approving...' : 'Approve'}
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                disabled={isReviewing && actionSubId === sub.submission?._id}
                                                                onClick={() => openReasonDialog(sub.submission?._id || '', 'reject', sub.activity?.title || '', sub.hp?.baseHp || 0)}
                                                            >
                                                                <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                                                                {isReviewing && actionSubId === sub.submission?._id ? 'Rejecting...' : 'Reject'}
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {(status === 'APPROVED' || status === 'REJECTED') && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            disabled={isReviewing && actionSubId === sub.submission?._id}
                                                            onClick={() => openReasonDialog(sub.submission?._id || '', 'revert', sub.activity?.title || '', sub.hp?.baseHp || 0)}
                                                        >
                                                            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                                            {isReviewing && actionSubId === sub.submission?._id ? 'Reverting...' : 'Revert'}
                                                        </Button>
                                                    )}
                                                    {status === 'REVERTED' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={isRestoring && actionSubId === sub.submission?._id}
                                                            onClick={() => openReasonDialog(sub.submission?._id || '', 'restore', sub.activity?.title)}
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                                            {isRestoring && actionSubId === sub.submission?._id ? 'Restoring...' : 'Restore'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* No submission yet */}
                                    {status === 'PENDING' && attachments.length === 0 && links.length === 0 && !sub.submission?.attachments?.textResponse && (
                                        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                                            No submission yet
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Reason Dialog for Revert/Restore/Approve/Reject */}
                <Dialog open={reasonDialog.open} onOpenChange={(open) => setReasonDialog({ ...reasonDialog, open })}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {reasonDialog.action === 'revert' ? 'Revert Submission' :
                                    reasonDialog.action === 'restore' ? 'Restore Submission' :
                                        reasonDialog.action === 'approve' ? 'Approve Submission' :
                                            'Reject Submission'}
                            </DialogTitle>
                            <DialogDescription>
                                {reasonDialog.action === 'revert'
                                    ? `This will revert the submission for "${reasonDialog.activityTitle}" and set the current HP to 0.`
                                    : reasonDialog.action === 'restore'
                                        ? `This will restore the submission for "${reasonDialog.activityTitle}" and reinstate the original HP.`
                                        : reasonDialog.action === 'approve'
                                            ? `This will approve the submission for "${reasonDialog.activityTitle}" and award HP points.`
                                            : `This will reject the submission for "${reasonDialog.activityTitle}" and may deduct HP points.`}
                            </DialogDescription>
                        </DialogHeader>

                        {(reasonDialog.action === 'reject' || reasonDialog.action === 'revert') && (
                            <div className="py-4 space-y-4">

                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Note <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <Textarea
                                        placeholder="Add feedback (minimum 10 characters)"
                                        value={reasonDialog.note}
                                        onChange={(e) =>
                                            setReasonDialog({ ...reasonDialog, note: e.target.value })
                                        }
                                        className="min-h-[80px]"
                                    />
                                    {reasonDialog.note && reasonDialog.note.length < 10 && (
                                        <p className="text-xs text-red-500 mt-1">
                                            Note must be at least 10 characters
                                        </p>
                                    )}
                                </div>

                                {reasonDialog.action === 'reject' && (
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Points to Deduct
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                max={reasonDialog.baseHp}
                                                value={reasonDialog.pointsToDeduct}
                                                onChange={(e) =>
                                                    setReasonDialog({
                                                        ...reasonDialog,
                                                        pointsToDeduct: Math.max(
                                                            0,
                                                            Math.min(
                                                                reasonDialog.baseHp,
                                                                parseInt(e.target.value) || 0
                                                            )
                                                        ),
                                                    })
                                                }
                                                className="w-24 px-3 py-2 border border-input rounded-md text-sm"
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                / {reasonDialog.baseHp} (base HP)
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setReasonDialog({ ...reasonDialog, open: false })}>Cancel</Button>
                            <Button
                                variant={reasonDialog.action === 'revert' || reasonDialog.action === 'reject' ? 'destructive' : 'default'}
                                onClick={handleConfirmAction}
                                disabled={(reasonDialog.action === 'approve' || reasonDialog.action === 'reject' || reasonDialog.action === 'revert') && isReviewing && actionSubId === reasonDialog.subId}
                            >
                                {reasonDialog.action === 'revert' ? 'Confirm Revert' :
                                    reasonDialog.action === 'restore' ? 'Confirm Restore' :
                                        reasonDialog.action === 'approve' ? 'Confirm Approve' :
                                            'Confirm Reject'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}
