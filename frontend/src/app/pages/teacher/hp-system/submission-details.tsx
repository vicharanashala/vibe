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
import { Pagination } from "@/components/ui/Pagination";
import { DirectionBadge } from "@/app/pages/teacher/hp-system/components/DirectionBadge";
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
                <Card className="bg-muted/50 border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
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
                                {/* Compact Instructor Info */}
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                    {(sub.instructorFeedback as any)?.reviewerName && (
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{(sub.instructorFeedback as any).reviewerName}</span>
                                            <span className="text-muted-foreground/60">•</span>
                                            <span className="truncate max-w-[150px]">{(sub.instructorFeedback as any).reviewerEmail}</span>
                                        </div>
                                    )}
                                    {(sub.instructorFeedback as any)?.reviewedAt && (
                                        <span className="text-xs">
                                            {new Date((sub.instructorFeedback as any).reviewedAt).toLocaleString("en-IN", {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    )}
                                </div>

                                {/* Compact Note */}
                                <div className="bg-background rounded-md border p-2.5">
                                    <p className="text-sm leading-relaxed">
                                        {String((sub.instructorFeedback as any)?.note || "No note provided")}
                                    </p>
                                </div>
                            </>
                        ) : (
                            /* Compact No Feedback State */
                            <div className="text-center py-4 text-muted-foreground">
                                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">No instructor feedback provided yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Feedback Controls Card */}
                <Card className="bg-muted/50 border">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Feedback Actions</CardTitle>
                        <CardDescription>
                            Manage feedback for this submission
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex flex-col gap-3">
                            {/* Update Feedback Button */}
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setShowInput(true)}
                                className="w-full shadow-md hover:shadow-lg transition-all duration-200 bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                                <MessageSquare className="h-4 w-4" />
                                {sub.instructorFeedback ? "Update Feedback" : "Add Feedback"}
                            </Button>

                            {/* View All Feedbacks */}
                            {sub.feedbacks && sub.feedbacks.length > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const panel = document.getElementById(`feedback-panel-${sub.submission?._id}`);
                                                panel?.classList.toggle('hidden');
                                            }}
                                            className="w-full"
                                        >
                                            {sub.feedbacks.length} Feedback{sub.feedbacks.length !== 1 ? 's' : ''}
                                            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${document.getElementById(`feedback-panel-${sub.submission?._id}`)?.classList.contains('hidden') ? '' : 'rotate-180'}`} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View all feedback given for this submission</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </CardContent>
                </Card>

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
                            placeholder="Write feedback for this submission (minimum 10 characters)..."
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

function TransactionSection({ ledgerEntries }: {
    ledgerEntries: any[];
}) {

    const [filter, setFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 5;

    // Convert ObjectId buffers to strings and normalize the data
    const normalizedTransactions = ledgerEntries.map((entry: any) => ({
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

    // Filter
    const filteredTransactions = normalizedTransactions.filter((t: any) =>
        filter === 'ALL' ? true : t.direction === filter
    );

    // Pagination
    const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
    const paginatedTransactions = filteredTransactions.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

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

                {/* Filter Buttons */}
                <div className="flex gap-2 pt-2">
                    {(['ALL', 'CREDIT', 'DEBIT'] as const).map((f) => (
                        <Button
                            key={f}
                            size="sm"
                            variant={filter === f ? 'default' : 'outline'}
                            onClick={() => { setFilter(f); setPage(1); }}
                            className="text-xs"
                        >
                            {f}
                        </Button>
                    ))}
                </div>
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
                            {paginatedTransactions.map((transaction: any, idx: number) => (
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
                                        <div className={`text-lg font-bold flex items-center justify-end gap-1 ${transaction.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                            <span className="mx-1">
                                                {transaction.direction === 'CREDIT' ? '+' : '-'}{Math.abs(transaction.hp)}
                                            </span>
                                            <Zap className="h-4 w-4 text-yellow-500" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center py-3">
                                        <DirectionBadge direction={transaction.direction} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalDocuments={filteredTransactions.length}
                    onPageChange={(p) => setPage(p)}
                />
            </CardContent>
        </Card>
    );
}

export default function SubmissionDetailsPage() {
    const [isTextExpanded, setIsTextExpanded] = useState(false);
    const { courseVersionId, cohortName, studentId, submissionId } = useParams({ strict: false });
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
    const { data: submissions, isLoading: submissionsLoading, error } = useHpStudentSubmissions(
        studentId || "", courseVersionId || "", cohortName || ""
    );
    const { data: students, isLoading: studentsLoading } = useHpStudents(courseVersionId || "", cohortName || "");
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

    const isApprovalMode = submission.rule.reward.applyWhen === "ON_APPROVAL";

    const openReasonDialog = (subId: string, action: 'revert' | 'restore' | 'approve' | 'reject', activityTitle: string, baseHp: number = 0) => {
        const displayTitle = activityTitle && !isNaN(Number(activityTitle))
            ? `Activity ${activityTitle}`
            : activityTitle || 'Activity';
        setReasonDialog({ open: true, subId, action, activityTitle: displayTitle, baseHp, note: '', pointsToDeduct: baseHp });
    };

    const handleConfirmAction = async () => {
        const { subId, action, note, pointsToDeduct } = reasonDialog;
        setReasonDialog({ ...reasonDialog, open: false });
        setActionType(action); // ✅ IMPORTANT
        setActionSubId(subId);
        try {
            if (action === 'restore') {
                toast.error("Restore functionality is not available yet. It will be added soon."); return
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
                            to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || "")}/student/${studentId}/submissions`
                        })}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            {submission.activity?.title || "Unknown Activity"}
                        </h2>
                        <p className="text-muted-foreground">
                            {student?.name || "Student"} · {student?.email || ""} · {decodeURIComponent(cohortName || "")}
                        </p>
                    </div>
                </div>

                {/* Status and Actions */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {/* <Badge variant={cfg.variant} className="flex items-center gap-1">
                                    <StatusIcon className="h-3 w-3" />
                                    {cfg.label}
                                </Badge> */}
                                {submission?.submission?.isLate && (
                                    <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                                        <Timer className="h-3 w-3 mr-1" />
                                        Late
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {status === 'SUBMITTED' || status === "APPROVED" ? (
                                    <Badge variant="outline" className={`text-sm font-semibold ${submission?.rule?.reward?.applyWhen === "ON_SUBMISSION" || status === "APPROVED" ? 'text-green-600 border-green-300 bg-green-50' : 'text-yellow-600 border-yellow-300 bg-yellow-50'}`}>
                                        {submission?.rule?.reward?.applyWhen === "ON_SUBMISSION" || status === "APPROVED" ? <><CheckCircle className="h-3 w-3 mr-1" /> Submitted</> : <> <Clock className="h-3 w-3 mr-1" /> In Review </>}

                                    </Badge>
                                ) : (
                                    <>
                                        <Badge variant="outline" className="text-sm font-semibold text-green-600">
                                            <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                                            {submission.hp?.currentHp || 0} HP
                                        </Badge>
                                        <Badge variant="outline" className="text-sm text-muted-foreground">
                                            Base: {submission.hp?.baseHp || 0}
                                        </Badge>
                                    </>
                                )}
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
                                        <div
                                            className={`grid gap-2 ${isApprovalMode
                                                    ? "grid-cols-1 sm:grid-cols-2"
                                                    : "grid-cols-1"
                                                }`}
                                        >
                                            {submission.rule.reward.applyWhen === "ON_APPROVAL" && (
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
                                            )}
                                            {submission.rule.reward.applyWhen === "ON_APPROVAL" ? <Button
                                                variant="destructive"
                                                size="sm"
                                                className="shadow-md hover:shadow-lg transition-all duration-200"
                                                disabled={isReviewing}
                                                onClick={() => openReasonDialog(submission?.submission?._id || '', 'reject', submission?.activity?.title || '', submission?.hp?.baseHp || 0)}
                                            >
                                                <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                                                {isReviewing && actionType === 'reject' ? 'Rejecting...' : 'Reject'}
                                            </Button> : <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-950/50 shadow-md hover:shadow-lg transition-all duration-200 font-medium w-full"
                                                disabled={isReviewing && actionSubId === submission?.submission?._id}
                                                onClick={() => openReasonDialog(submission?.submission?._id || '', 'revert', submission?.activity?.title || '', submission?.hp?.baseHp || 0)}
                                            >
                                                <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                                {isReviewing && actionSubId === submission?.submission?._id ? 'Reverting...' : 'Revert Decision'}
                                            </Button>}
                                        </div>
                                    )}
                                    {(status === 'APPROVED' || status === 'REJECTED') && (
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
                                    {status === 'REVERTED' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/50 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                                            disabled={isRestoring && actionSubId === submission?.submission?._id}
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
