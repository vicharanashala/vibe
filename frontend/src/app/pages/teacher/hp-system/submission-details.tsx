// @ts-nocheck

import { useState, useCallback } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentSubmissions, useHpStudents, useRevertHpEntry, useRestoreHpEntry, useReviewSubmission, useAddFeedback } from "@/hooks/hooks";
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
    Timer, Send, Zap, Undo2, ThumbsUp, ThumbsDown, ChevronDown, AlertTriangle
} from "lucide-react";
import type { SubmissionAttachment, HpStudentSubmission } from "@/lib/api/hp-system";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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
    const [isExpanded, setIsExpanded] = useState(false);
    const toggleExpansion = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    }, [isExpanded]);

    const displayName = attachment.name || attachment.url || '';
    const shouldShowExpandable = displayName && displayName.length > 30;
    const displayText = isExpanded ? displayName : displayName.substring(0, 30);
    if (attachment.type === 'image') {
        return (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block group">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                    <img src={attachment.url} alt={attachment.name || 'Image'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[80px]">
                    {displayText}
                    {shouldShowExpandable && (
                        <span
                            onClick={toggleExpansion}
                            className="text-primary hover:text-primary/80 cursor-pointer text-xs ml-1"
                        >
                            {isExpanded ? ' (show less)' : '...view more'}
                        </span>
                    )}
                </p>
            </a>
        );
    }
    return (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors group max-w-[220px]"
        >
            <AttachmentIcon type={attachment.type} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {displayText}
                    {shouldShowExpandable && (
                        <span
                            onClick={toggleExpansion}
                            className="text-primary hover:text-primary/80 cursor-pointer text-xs ml-1"
                        >
                            {isExpanded ? ' (show less)' : '...view more'}
                        </span>
                    )}
                </p>
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
                {/* Instructor Feedback Display Card */}
                <Card className="border bg-muted/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                Instructor Feedback
                            </div>
                            <Badge variant="secondary" className="text-xs">
                                {String((sub.instructorFeedback as any)?.decision || "Reviewed")}
                            </Badge>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="pt-0">
                        {sub.instructorFeedback ? (
                            <>
                                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                                    {(sub.instructorFeedback as any)?.reviewerName && (
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {(sub.instructorFeedback as any).reviewerName}
                                            </span>
                                            <span className="text-muted-foreground/60">•</span>
                                            <span className="max-w-[150px] truncate">
                                                {(sub.instructorFeedback as any).reviewerEmail}
                                            </span>
                                        </div>
                                    )}

                                    {(sub.instructorFeedback as any)?.reviewedAt && (
                                        <span className="text-xs">
                                            {new Date(
                                                (sub.instructorFeedback as any).reviewedAt
                                            ).toLocaleString("en-IN", {
                                                day: "numeric",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    )}
                                </div>

                                <div className="rounded-md border bg-background p-2.5">
                                    <p className="text-sm leading-relaxed">
                                        {String(
                                            (sub.instructorFeedback as any)?.note || "No note provided"
                                        )}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="py-4 text-center text-muted-foreground">
                                <MessageSquare className="mx-auto mb-2 h-6 w-6 opacity-50" />
                                <p className="text-xs">No instructor feedback provided yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Feedback Controls Card */}
                <Card className="border bg-muted/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Feedback Actions</CardTitle>
                        <CardDescription>
                            Manage feedback for this submission
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0">
                        <div className="flex flex-col gap-3">
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setShowInput(true)}
                                className="w-full bg-primary text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg"
                            >
                                <MessageSquare className="h-4 w-4" />
                                {sub.instructorFeedback ? "Update Feedback" : "Add Feedback"}
                            </Button>

                            {sub.feedbacks && sub.feedbacks.length > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const panel = document.getElementById(
                                                    `feedback-panel-${sub.submission?._id}`
                                                );
                                                panel?.classList.toggle("hidden");
                                            }}
                                            className="w-full"
                                        >
                                            {sub.feedbacks.length} Feedback
                                            {sub.feedbacks.length !== 1 ? "s" : ""}
                                            <ChevronDown
                                                className={`ml-2 h-4 w-4 transition-transform ${document
                                                    .getElementById(`feedback-panel-${sub.submission?._id}`)
                                                    ?.classList.contains("hidden")
                                                    ? ""
                                                    : "rotate-180"
                                                    }`}
                                            />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        View all feedback given for this submission
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Feedback Panel */}
                {sub.feedbacks && sub.feedbacks.length > 0 && (
                    <div
                        id={`feedback-panel-${sub.submission?._id}`}
                        className="hidden rounded-lg border bg-muted/20 p-2"
                    >
                        <div className="space-y-2">
                            {sub.feedbacks.map((feedback: any, idx: number) => (
                                <div key={idx} className="rounded border bg-background p-3">
                                    <div className="mb-2 flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">
                                                {feedback.username || "Anonymous"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {feedback.email || "N/A"}
                                            </div>
                                        </div>

                                        {feedback.feedbackAt && (
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(feedback.feedbackAt).toLocaleDateString("en-IN")}
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-sm leading-relaxed">{feedback.feedback}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add Feedback Input */}
                {showInput && (
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                        <Textarea
                            placeholder="Write feedback for this submission (minimum 10 characters)..."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            rows={3}
                            className="resize-none bg-background"
                        />

                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowInput(false);
                                    setFeedbackText("");
                                }}
                            >
                                Cancel
                            </Button>

                            <Button
                                size="sm"
                                disabled={
                                    !feedbackText.trim() ||
                                    feedbackText.trim().length < 10 ||
                                    isPending
                                }
                                onClick={handleSubmitFeedback}
                                className="flex items-center gap-2"
                            >
                                {isPending ? (
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-white" />
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

function TransactionSection({ ledgerEntries }: {
    ledgerEntries: any[];
}) {

    // Convert ObjectId buffers to strings and normalize the data
    const normalizedTransactions = [...ledgerEntries].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).map((entry: any) => ({
        ...entry,
        _id: entry._id?.toString?.() || entry._id,
        submissionId: entry.submissionId?.toString?.() || entry.submissionId,
        activityId: entry.activityId?.toString?.() || entry.activityId,
        courseId: entry.courseId?.toString?.() || entry.courseId,
        courseVersionId: entry.courseVersionId?.toString?.() || entry.courseVersionId,
        studentId: entry.studentId?.toString?.() || entry.studentId,
        triggeredByUserId: entry.meta?.triggeredByUserId?.toString?.() || entry.meta?.triggeredByUserId,
        hp: entry.amount || 0, // Map amount to hp for compatibility
        direction: entry.direction,
        eventType: entry.eventType,
        note: entry.meta?.note || '',
        createdAt: entry.createdAt,
        reasonCode: entry.calc?.reasonCode || '',
        baseHpAtTime: entry.calc?.baseHpAtTime || 0,
        computedAmount: entry.calc?.computedAmount || 0,
        triggeredBy: entry.meta?.triggeredBy || 'SYSTEM',
        withinDeadline: entry.calc?.withinDeadline,
        deadlineAt: entry.calc?.deadlineAt,
    }));

    if (normalizedTransactions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        Related Transactions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6 text-muted-foreground">
                        No transactions found for this submission
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3">
                    <Zap className="h-6 w-6 text-yellow-500" />
                    HP Ledger Transactions
                    <Badge variant="outline" className="ml-auto text-sm font-medium">
                        {normalizedTransactions.length} Transaction{normalizedTransactions.length !== 1 ? 's' : ''}
                    </Badge>
                </CardTitle>
                <CardDescription className="text-base">
                    House Points awarded/credited for this submission
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                {/* Transaction Table */}
                <div className="rounded-lg border bg-muted/30">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-32">Date</TableHead>
                                <TableHead className="w-24">Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-20 text-right">HP</TableHead>
                                <TableHead className="w-20 text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {normalizedTransactions.map((transaction: any, idx: number) => (
                                <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="text-sm font-medium py-3">
                                        <div className="flex items-center gap-2">
                                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                            <span>{formatDate(transaction.createdAt)}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Badge
                                            variant={transaction.hp > 0 ? "default" : "destructive"}
                                            className="text-xs font-semibold px-2 py-1"
                                        >
                                            {transaction.eventType || 'CREDIT'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm py-3">
                                        <div className="font-medium">{transaction.note || 'HP Awarded'}</div>
                                        {transaction.reasonCode && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Reason: {transaction.reasonCode.replace('_', ' ')}
                                            </div>
                                        )}
                                        {transaction.withinDeadline !== undefined && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Status: {transaction.withinDeadline ? 'On Time' : 'Late'}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right py-3">
                                        <div className={`text-lg font-bold flex items-center justify-end gap-1 ${transaction.eventType == "CREDIT" ? 'text-green-600' : 'text-red-600'}`}>
                                            {transaction.eventType == "CREDIT" && <ThumbsUp className="h-4 w-4 " />}
                                            {transaction.eventType == "DEBIT" && <ThumbsDown className="h-4 w-4" />}
                                            {/* <span className="mx-1">{transaction.eventType == "CREDIT" ? '+' : ''}{Math.abs(transaction.hp)}</span> */}
                                            <span className={`font-semibold ${transaction.direction === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {transaction.direction === 'CREDIT' ? '+' : '-'}{transaction.hp}
                                            </span>
                                            <Zap className="h-4 w-4 text-yellow-500" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center py-3">
                                        <Badge
                                            variant={transaction.direction === 'CREDIT' ? 'default' : 'secondary'}
                                            className={`text-xs font-semibold px-2 py-1 ${transaction.direction === 'CREDIT' ? 'bg-green-100 text-green-800 border-green-200' :
                                                'bg-red-100 text-red-800 border-red-200'
                                                }`}
                                        >
                                            {transaction.direction || 'CREDIT'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

export default function SubmissionDetailsPage() {
    const [isTextExpanded, setIsTextExpanded] = useState(false);
    const { courseVersionId, cohortId, studentId, submissionId } = useParams({ strict: false });
    const navigate = useNavigate();

    // Check if submissionId is provided
    if (!submissionId) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>Submission ID is required</span>
            </div>
        );
    }
    const { data: submissions, isLoading: submissionsLoading, error, refetch } = useHpStudentSubmissions(
        studentId || "", courseVersionId || "", cohortId || ""
    );
    const { data: students, isLoading: studentsLoading } = useHpStudents(courseVersionId || "", cohortId || "");
    const student = students.find(s => s._id === studentId);

    const { mutateAsync: revertEntry, isPending: isReverting } = useRevertHpEntry();
    const { mutateAsync: restoreEntry, isPending: isRestoring } = useRestoreHpEntry();
    const { mutateAsync: reviewSubmission, isPending: isReviewing } = useReviewSubmission();

    // Find the specific submission
    const submission = submissions?.find((sub: any) => sub.submission?._id === submissionId);
    console.log("Found submission details: ", submission);

    const toggleTextExpansion = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsTextExpanded(!isTextExpanded);
    }, [isTextExpanded]);

    const textResponse = submission?.submission?.attachments?.textResponse || '';
    const shouldShowExpandable = textResponse && textResponse.length > 200;
    const displayText = isTextExpanded ? textResponse : textResponse.substring(0, 200);

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

    const [actionType, setActionType] = useState<"approve" | "reject" | "revert" | null>(null);

    const openReasonDialog = (subId: string, action: 'revert' | 'restore' | 'approve' | 'reject', activityTitle: string, baseHp: number = 0) => {
        const displayTitle = activityTitle && !isNaN(Number(activityTitle))
            ? `Activity ${activityTitle}`
            : activityTitle || 'Activity';
        setReasonDialog({ open: true, subId, action, activityTitle: displayTitle, baseHp, note: '', pointsToDeduct: baseHp });
    };

    const handleConfirmAction = async () => {
    const { subId, action, note, pointsToDeduct } = reasonDialog;
    setReasonDialog({ ...reasonDialog, open: false });
    setActionType(action);
    setActionSubId(subId);
    try {
        if (action === 'restore') {
            await restoreEntry({ entryId: subId, note: note.trim() || undefined });
            await refetch();
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

    if (submissionsLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!submission) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>Submission not found</span>
            </div>
        );
    }

    const status = submission?.submission?.status || 'PENDING';
    const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const StatusIcon = cfg.icon;
    const attachments = [
        ...(submission?.submission?.attachments?.files || []).map((f: any) => ({ ...f, type: 'document' })),
        ...(submission?.submission?.attachments?.images || []).map((i: any) => ({ ...i, type: 'image' }))
    ];
    const links = submission?.submission?.attachments?.links || [];

    return (
        <TooltipProvider>
            <div className="space-y-6 w-full pb-12">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate({
                            to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortId || "")}/student/${studentId}/submissions`
                        })}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            {submission.activity?.title || "Unknown Activity"}
                        </h2>
                        <p className="text-muted-foreground">
                            {student?.name || "Student"} · {student?.email || ""} · {decodeURIComponent(cohortId || "")}
                        </p>
                    </div>
                </div>

                {/* Status and Actions */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Badge variant={cfg.variant} className="flex items-center gap-1">
                                    <StatusIcon className="h-3 w-3" />
                                    {cfg.label}
                                </Badge>
                                {status === "SUBMITTED" && submission.rule.reward?.applyWhen !== "ON_SUBMISSION" && (
                                    <Badge variant="outline" className="text-sm font-semibold text-white">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Wating for Approval
                                    </Badge>
                                )}
                                {submission?.submission?.isLate && (
                                    <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                                        <Timer className="h-3 w-3 mr-1" />
                                        Late
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">


                                <Badge variant="outline" className="text-sm text-muted-foreground">
                                    Activity Points: {submission.rule?.reward?.value || 0}
                                </Badge>

                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                                <p className="text-sm">{submission.deadline ? formatDate(submission.deadline) : '—'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Submitted Date</p>
                                <p className="text-sm">{submission?.submission?.submittedAt ? formatDate(submission.submission.submittedAt) : '—'}</p>
                            </div>
                        </div>
                        {submission.activity?.description && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-muted-foreground mb-2">Activity Description</p>
                                <p className="text-sm">{submission.activity.description}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Submission Content */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Submission Content</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Text response */}
                        {textResponse && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">Text Response</p>
                                <div className="p-3 bg-muted/30 rounded border text-sm whitespace-pre-wrap">
                                    {displayText}
                                    {shouldShowExpandable && (
                                        <span
                                            onClick={toggleTextExpansion}
                                            className="text-primary hover:text-primary/80 cursor-pointer text-xs ml-1"
                                        >
                                            {isTextExpanded ? ' (show less)' : '...view more'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Links */}
                        {links.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1.5">Links</p>
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
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                    Attachments ({attachments.length})
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    {attachments.map((att: any, idx: number) => (
                                        <AttachmentPreview key={idx} attachment={att} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No submission yet */}
                        {status === 'PENDING' && attachments.length === 0 && links.length === 0 && !submission?.submission?.attachments?.textResponse && (
                            <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                                No submission yet
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Feedback Section */}
                {status !== 'PENDING' && (
                    <>
                        {/* Review Actions Card */}
                        <Card className="bg-muted/50 border">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                    Review Actions
                                    <Badge variant="secondary" className="ml-auto">
                                        {status === 'SUBMITTED' ? 'Pending' : status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Reverted'}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Manage submission approval and status
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="grid grid-cols-1 gap-3">
                                    {status === 'SUBMITTED' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {submission.rule.reward.applyWhen === "ON_APPROVAL" ? (
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    className="shadow-md hover:shadow-lg transition-all duration-200"
                                                    disabled={isReviewing}
                                                    onClick={() => openReasonDialog(submission?.submission?._id || '', 'approve', submission?.activity?.title || '', submission?.hp?.baseHp || 0)}
                                                >
                                                    <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                                                    {isReviewing && actionType === 'approve' ? 'Approving...' : 'Approve'}
                                                </Button>
                                            ) : (<Button
                                                variant="outline"
                                                size="sm"
                                                className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-950/50 shadow-md hover:shadow-lg transition-all duration-200 font-medium w-full"
                                                disabled={isReviewing && actionSubId === submission?.submission?._id}
                                                onClick={() => openReasonDialog(submission?.submission?._id || '', 'revert', submission?.activity?.title || '', submission?.hp?.baseHp || 0)}
                                            >
                                                <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                                {isReviewing && actionSubId === submission?.submission?._id ? 'Reverting...' : 'Revert'}
                                            </Button>)}
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="shadow-md hover:shadow-lg transition-all duration-200"
                                                disabled={isReviewing}
                                                onClick={() => openReasonDialog(submission?.submission?._id || '', 'reject', submission?.activity?.title || '', submission?.hp?.baseHp || 0)}
                                            >
                                                <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                                                {isReviewing && actionType === 'reject' ? 'Rejecting...' : 'Reject'}
                                            </Button>
                                        </div>
                                    )}
                                    {status === 'APPROVED' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-950/50 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                                            disabled={isReviewing && actionSubId === submission?.submission?._id}
                                            onClick={() => openReasonDialog(submission?.submission?._id || '', 'revert', submission?.activity?.title || '', submission?.hp?.baseHp || 0)}
                                        >
                                            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                            {isReviewing && actionSubId === submission?.submission?._id ? 'Reverting...' : 'Revert Decision'}
                                        </Button>
                                    )}
                                    {(status === 'REVERTED' || status === 'REJECTED') && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/50 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                                                disabled={isReviewing && actionSubId === submission?.submission?._id}
                                                onClick={() => openReasonDialog(submission?.submission?._id || '', 'restore', submission?.activity?.title)}
                                            >
                                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                            {isRestoring && actionSubId === submission?.submission?._id ? 'Restoring...' : 'Restore Submission'}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Feedback & Review Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5" />
                                    Feedback & Review
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <FeedbackSection sub={submission} />
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* Related Transactions */}
                <TransactionSection
                    ledgerEntries={submission?.ledgerEntries || []}
                />

                {/* Reason Dialog */}
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

                        {(reasonDialog.action === 'reject' || reasonDialog.action === 'revert' || reasonDialog.action === 'restore') && (
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
