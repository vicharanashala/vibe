import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentSubmissions, useHpStudents, useRevertHpEntry, useRestoreHpEntry } from "@/hooks/hooks";
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
    Timer, ShieldCheck, ShieldAlert, Send, Zap, Undo2
} from "lucide-react";
import type { SubmissionAttachment, HpStudentSubmission } from "@/lib/api/hp-system";

const statusConfig = {
    SUBMITTED: { label: "Submitted", variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
    PENDING: { label: "Pending", variant: "secondary" as const, icon: Clock, color: "text-yellow-600" },
    REVERTED: { label: "Reverted", variant: "destructive" as const, icon: XCircle, color: "text-red-600" },
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
                    <img src={attachment.url} alt={attachment.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
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
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{attachment.name}</p>
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
                        Instructor Feedback
                    </div>
                    <p className="text-sm">{sub.instructorFeedback}</p>
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

    const [actionSubId, setActionSubId] = useState<string | null>(null);
    const [reasonDialog, setReasonDialog] = useState<{
        open: boolean;
        subId: string;
        action: 'revert' | 'restore';
        activityTitle: string;
    }>({ open: false, subId: '', action: 'revert', activityTitle: '' });

    const openReasonDialog = (subId: string, action: 'revert' | 'restore', activityTitle: string) => {
        setReasonDialog({ open: true, subId, action, activityTitle });
    };

    const handleConfirmAction = async () => {
        const { subId, action } = reasonDialog;
        setReasonDialog({ ...reasonDialog, open: false });
        setActionSubId(subId);
        try {
            if (action === 'revert') {
                await revertEntry(subId);
            } else {
                await restoreEntry(subId);
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
                <span>{error}</span>
            </div>
        );
    }

    const totalActivities = submissions.length;
    const submitted = submissions.filter(s => s.status === "SUBMITTED").length;
    const pending = submissions.filter(s => s.status === "PENDING").length;
    const late = submissions.filter(s => s.isLate).length;
    const totalCurrentHp = submissions.reduce((sum, s) => sum + s.currentHp, 0);
    const totalBaseHp = submissions.reduce((sum, s) => sum + s.baseHp, 0);

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
                {submissions.map(sub => {
                    const cfg = statusConfig[sub.status];
                    const StatusIcon = cfg.icon;
                    return (
                        <Card key={sub._id} className={`border-l-4 ${sub.status === 'SUBMITTED' ? 'border-l-green-500' : sub.status === 'REVERTED' ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="text-base">{sub.activityTitle}</CardTitle>
                                        {sub.activityDescription && (
                                            <p className="text-sm text-muted-foreground mt-1">{sub.activityDescription}</p>
                                        )}
                                        <CardDescription className="flex flex-wrap items-center gap-3 mt-1.5">
                                            {sub.dueDate && (
                                                <span className="flex items-center gap-1 text-xs">
                                                    <CalendarClock className="h-3 w-3" />
                                                    Due: {formatDate(sub.dueDate)}
                                                </span>
                                            )}
                                            {sub.submissionCount > 0 && (
                                                <span className="flex items-center gap-1 text-xs">
                                                    <RotateCcw className="h-3 w-3" />
                                                    {sub.submissionCount} submission{sub.submissionCount !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* HP badges */}
                                        <Badge variant="outline" className="text-sm font-semibold text-green-600">
                                            <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                                            {sub.currentHp} HP
                                        </Badge>
                                        <Badge variant="outline" className="text-sm text-muted-foreground">
                                            Base: {sub.baseHp}
                                        </Badge>
                                        {sub.isLate && (
                                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                                                <Timer className="h-3 w-3 mr-1" />
                                                Late
                                            </Badge>
                                        )}
                                        {sub.safetyStatus && (
                                            <Badge
                                                variant="outline"
                                                className={
                                                    sub.safetyStatus === 'safe'
                                                        ? 'text-green-700 border-green-300 bg-green-50 dark:bg-green-950/20'
                                                        : 'text-red-700 border-red-300 bg-red-50 dark:bg-red-950/20'
                                                }
                                            >
                                                {sub.safetyStatus === 'safe'
                                                    ? <ShieldCheck className="h-3 w-3 mr-1" />
                                                    : <ShieldAlert className="h-3 w-3 mr-1" />
                                                }
                                                {sub.safetyStatus === 'safe' ? 'Safe' : 'Unsafe'}
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
                                {(sub.submittedAt || sub.lastUpdated) && (
                                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                        {sub.submittedAt && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5" />
                                                Submitted: {formatDate(sub.submittedAt)}
                                            </span>
                                        )}
                                        {sub.lastUpdated && sub.lastUpdated !== sub.submittedAt && (
                                            <span className="flex items-center gap-1">
                                                <RotateCcw className="h-3.5 w-3.5" />
                                                Last Updated: {formatDate(sub.lastUpdated)}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Submission Link */}
                                {sub.submissionLink && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Link</p>
                                        <a
                                            href={sub.submissionLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                                        >
                                            <Link2 className="h-3.5 w-3.5" />
                                            {sub.submissionLink}
                                        </a>
                                    </div>
                                )}

                                {/* Attachments */}
                                {sub.attachments.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">
                                            Attachments ({sub.attachments.length})
                                        </p>
                                        <div className="flex flex-wrap gap-3">
                                            {sub.attachments.map(att => (
                                                <AttachmentPreview key={att._id} attachment={att} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Instructor Feedback + Revert/Restore Actions */}
                                {sub.status !== 'PENDING' && (
                                    <>
                                        <Separator />
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <FeedbackSection sub={sub} />
                                            </div>
                                            <div className="flex-shrink-0 pt-1">
                                                {sub.status === 'SUBMITTED' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        disabled={isReverting && actionSubId === sub._id}
                                                        onClick={() => openReasonDialog(sub._id, 'revert', sub.activityTitle)}
                                                    >
                                                        <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                                        {isReverting && actionSubId === sub._id ? 'Reverting...' : 'Revert'}
                                                    </Button>
                                                )}
                                                {sub.status === 'REVERTED' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={isRestoring && actionSubId === sub._id}
                                                        onClick={() => openReasonDialog(sub._id, 'restore', sub.activityTitle)}
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                                        {isRestoring && actionSubId === sub._id ? 'Restoring...' : 'Restore'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* No submission yet */}
                                {sub.status === 'PENDING' && sub.attachments.length === 0 && !sub.submissionLink && (
                                    <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                                        No submission yet
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Reason Dialog for Revert/Restore */}
            <Dialog open={reasonDialog.open} onOpenChange={(open) => setReasonDialog({ ...reasonDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {reasonDialog.action === 'revert' ? 'Revert Submission' : 'Restore Submission'}
                        </DialogTitle>
                        <DialogDescription>
                            {reasonDialog.action === 'revert'
                                ? `This will revert the submission for "${reasonDialog.activityTitle}" and set the current HP to 0.`
                                : `This will restore the submission for "${reasonDialog.activityTitle}" and reinstate the original HP.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReasonDialog({ ...reasonDialog, open: false })}>Cancel</Button>
                        <Button
                            variant={reasonDialog.action === 'revert' ? 'destructive' : 'default'}
                            onClick={handleConfirmAction}
                        >
                            {reasonDialog.action === 'revert' ? 'Confirm Revert' : 'Confirm Restore'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
