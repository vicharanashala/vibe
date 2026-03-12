import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentSubmissions, useHpStudents, useRevertHpEntry, useRestoreHpEntry, useReviewSubmission } from "@/hooks/hooks";
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
    Timer, Send, Zap, Undo2, ThumbsUp, ThumbsDown
} from "lucide-react";
import type { SubmissionAttachment, HpStudentSubmission } from "@/lib/api/hp-system";

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showInput, setShowInput] = useState(false);

    const handleSubmitFeedback = async () => {
        if (!feedbackText.trim()) return;
        setIsSubmitting(true);
        await new Promise(r => setTimeout(r, 500));
        setIsSubmitting(false);
        setFeedbackText("");
        setShowInput(false);
    };

    return (
        <div className="space-y-3">
            {sub.instructorFeedback && (
                <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Instructor Note: {String(sub.instructorFeedback?.decision || 'Reviewed')}
                    </div>
                    <p className="text-sm">{String(sub.instructorFeedback?.note || 'No note provided')}</p>
                </div>
            )}

            {showInput ? (
                <div className="space-y-2">
                    <Textarea
                        placeholder="Write feedback for this submission..."
                        value={feedbackText}
                        onChange={e => setFeedbackText(e.target.value)}
                        rows={3}
                        className="resize-none"
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
                            disabled={!feedbackText.trim() || isSubmitting}
                            onClick={handleSubmitFeedback}
                        >
                            {isSubmitting ? (
                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-2" />
                            ) : (
                                <Send className="h-3.5 w-3.5 mr-2" />
                            )}
                            {isSubmitting ? "Sending..." : "Send Feedback"}
                        </Button>
                    </div>
                </div>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInput(true)}
                    className="w-full"
                >
                    <MessageSquare className="h-3.5 w-3.5 mr-2" />
                    {sub.instructorFeedback ? "Update Feedback" : "Add Feedback"}
                </Button>
            )}
        </div>
    );
}

export default function StudentSubmissionsPage() {
    const { courseVersionId, cohortName, studentId } = useParams({ strict: false });
    const navigate = useNavigate();
    const { data: submissions, isLoading, error } = useHpStudentSubmissions(
        studentId || "", courseVersionId || "", cohortName || ""
    );
    const { data: students } = useHpStudents(courseVersionId || "", cohortName || "");
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
        note: string;
    }>({ open: false, subId: '', action: 'revert', activityTitle: '', note: '' });

    const openReasonDialog = (subId: string, action: 'revert' | 'restore' | 'approve' | 'reject', activityTitle: string) => {
        setReasonDialog({ open: true, subId, action, activityTitle, note: '' });
    };

    const handleConfirmAction = async () => {
        const { subId, action, note } = reasonDialog;
        setReasonDialog({ ...reasonDialog, open: false });
        setActionSubId(subId);
        try {
            if (action === 'revert') {
                await revertEntry(subId);
            } else if (action === 'restore') {
                await restoreEntry(subId);
            } else if (action === 'approve' || action === 'reject') {
                await reviewSubmission({ 
                    submissionId: subId, 
                    decision: action === 'approve' ? 'APPROVED' : 'REJECTED', 
                    note: note.trim() || undefined 
                });
            }
        } finally {
            setActionSubId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>{String(error)}</span>
            </div>
        );
    }

    if (!submissions || submissions.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-muted-foreground">No submissions found for this student.</div>
            </div>
        );
    }

    const totalActivities = submissions?.length || 0;
    const submitted = submissions?.filter((s: any) => s.submission?.status === "SUBMITTED").length || 0;
    const pending = submissions?.filter((s: any) => s.submission?.status === "PENDING").length || 0;
    const late = submissions?.filter((s: any) => s.submission?.isLate).length || 0;
    const totalCurrentHp = submissions?.reduce((sum: number, s: any) => sum + (s.hp?.currentHp || 0), 0) || 0;
    const totalBaseHp = submissions?.reduce((sum: number, s: any) => sum + (s.hp?.baseHp || 0), 0) || 0;

    return (
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
            <div className="grid gap-4 md:grid-cols-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Activities</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            {totalActivities}
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
                            {submitted}
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
                            {pending}
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
                            {late}
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
                            {totalCurrentHp}
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

            {/* Submission Cards */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Activity Submissions</h3>
                {submissions.map((sub: any) => {
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
                                        <Badge variant="outline" className="text-sm font-semibold text-green-600">
                                            <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                                            {sub.hp?.currentHp || 0} HP
                                        </Badge>
                                        <Badge variant="outline" className="text-sm text-muted-foreground">
                                            Base: {sub.hp?.baseHp || 0}
                                        </Badge>
                                        {sub.submission?.isLate && (
                                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                                                <Timer className="h-3 w-3 mr-1" />
                                                Late
                                            </Badge>
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
                                                                onClick={() => openReasonDialog(sub.submission?._id || '', 'approve', sub.activity?.title)}
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
                                                            onClick={() => openReasonDialog(sub.submission?._id || '', 'reject', sub.activity?.title)}
                                                        >
                                                            <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                                                            {isReviewing && actionSubId === sub.submission?._id ? 'Rejecting...' : 'Reject'}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            disabled={isReverting && actionSubId === sub.submission?._id}
                                                            onClick={() => openReasonDialog(sub.submission?._id || '', 'revert', sub.activity?.title)}
                                                        >
                                                            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                                            {isReverting && actionSubId === sub.submission?._id ? 'Reverting...' : 'Revert'}
                                                        </Button>
                                                    </div>
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
                    
                    {(reasonDialog.action === 'approve' || reasonDialog.action === 'reject') && (
                        <div className="py-4">
                            <label htmlFor="note" className="text-sm font-medium mb-2 block">
                                Note (optional)
                            </label>
                            <Textarea
                                id="note"
                                placeholder="Add any feedback or notes..."
                                value={reasonDialog.note}
                                onChange={(e) => setReasonDialog({ ...reasonDialog, note: e.target.value })}
                                className="min-h-[80px]"
                            />
                        </div>
                    )}
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReasonDialog({ ...reasonDialog, open: false })}>Cancel</Button>
                        <Button
                            variant={reasonDialog.action === 'revert' || reasonDialog.action === 'reject' ? 'destructive' : 'default'}
                            onClick={handleConfirmAction}
                            disabled={(reasonDialog.action === 'approve' || reasonDialog.action === 'reject') && isReviewing && actionSubId === reasonDialog.subId}
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
    );
}
