import { useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentSubmissions, useHpStudents, useRevertHpEntry, useRestoreHpEntry, useReviewSubmission, useAddFeedback, useHpStudentSubmissionStats } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/Pagination";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    ArrowLeft,
    ExternalLink,
    Clock,
    FileText,
    CheckCircle,
    AlertCircle,
    XCircle,
    Image as ImageIcon,
    File,
    Link2,
    MessageSquare,
    CalendarClock,
    RotateCcw,
    Timer,
    Send,
    Zap,
    Undo2,
    ThumbsUp,
    ThumbsDown,
    ChevronDown,
    ChevronUp,
    Mail,
    User,
    Search
} from "lucide-react";
import type { HpStudentSubmission } from "@/lib/api/hp-system";

const statusConfig = {
    SUBMITTED: { label: "Submitted", variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
    PENDING: { label: "Wating Approval", variant: "secondary" as const, icon: Clock, color: "text-yellow-600" },
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

function SimplifiedSubmissionCard({ sub, onViewMore }: { sub: HpStudentSubmission; onViewMore: () => void }) {
    const [isTextExpanded, setIsTextExpanded] = useState(false);
    const status = sub.status || 'PENDING';
    const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const StatusIcon = cfg.icon;

    const textResponse = sub.submission?.attachments?.textResponse || '';
    const shouldShowExpandable = textResponse && textResponse.length > 100;
    const displayText = isTextExpanded ? textResponse : textResponse.substring(0, 100);

    console.log("Rendring values of sub here-> ", sub);

    const toggleTextExpansion = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsTextExpanded(!isTextExpanded);
    }, [isTextExpanded]);

    const submissionStatus = sub.submission?.status || "PENDING";
    const isOnSubmissionReward = sub.rule.reward.applyWhen === "ON_SUBMISSION";

    return (
        <Card className={`border-l-4 ${status === 'SUBMITTED' ? 'border-l-green-500' : status === 'REVERTED' ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">{sub.activity?.title || "Unknown Activity"}</CardTitle>
                        {sub.activity?.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{sub.activity.description}</p>
                        )}
                        <CardDescription className="flex flex-wrap items-center gap-3 mt-1.5">
                            {sub.deadline && (
                                <span className="flex items-center gap-1 text-xs">
                                    <CalendarClock className="h-3 w-3" />
                                    Due: {formatDate(sub.deadline)}
                                </span>
                            )}
                            {sub.submission?.submittedAt && (
                                <span className="flex items-center gap-1 text-xs">
                                    <Clock className="h-3 w-3" />
                                    Submitted: {(sub.submission?.submittedAt) ? formatDate(sub.submission.submittedAt) : '—'}
                                </span>
                            )}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">

                        {/* 1. STATUS BADGE */}
                        {(submissionStatus === "SUBMITTED" && sub.rule.reward.applyWhen !== "ON_SUBMISSION") && (
                            <Badge variant="outline" className="text-sm font-semibold text-yellow-600">
                                <Clock className="h-3 w-3 mr-1" />
                                In Review
                            </Badge>
                        )}

                        {submissionStatus === "APPROVED" && (
                            <Badge variant="outline" className="text-sm font-semibold text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approved
                            </Badge>
                        )}

                        {submissionStatus === "REJECTED" && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                Rejected
                            </Badge>
                        )}

                        {submissionStatus === "REVERTED" && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                                <RotateCcw className="h-3 w-3" />
                                Reverted
                            </Badge>
                        )}

                        {/* 2. HP BADGE */}
                    {sub.rule.reward.enabled ? (
                        <>
                        {(isOnSubmissionReward || submissionStatus === "APPROVED") && (
                            <Badge variant="outline" className="text-sm font-semibold text-green-600">
                                <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                                {sub.rule.reward.value} HP
                            </Badge>
                        )}

                        {/* 3. BASE / REWARD INFO */}
                        <Badge variant="outline" className="text-sm text-muted-foreground">

                            Activity Reward {sub.rule.reward.value}

                        </Badge>
                        </>
                    ) : (
                        <Badge variant={"outline"} className="text-sm text-muted-foreground">No Reward</Badge>
                    )}
                        {/* 4. LATE FLAG */}
                        {sub.isLate && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                                <Timer className="h-3 w-3 mr-1" />
                                Late
                            </Badge>
                        )}

                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
                {/* Text response preview - full width with expandable functionality */}
                {textResponse && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Response Preview</p>
                        <div className="p-2 bg-muted/30 rounded border text-sm w-full">
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

                {/* Attachments count and View More button */}
                <div className="flex items-center justify-end gap-2">
                    {/* Attachments count - more noticeable and bigger */}
                    {((sub.submission?.attachments?.files?.length || 0) + (sub.submission?.attachments?.images?.length || 0) + (sub.submission?.attachments?.links?.length || 0)) > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
                            <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>
                            <span className="text-sm font-medium text-foreground">
                                attachments: {((sub.submission?.attachments?.files?.length || 0) + (sub.submission?.attachments?.images?.length || 0) + (sub.submission?.attachments?.links?.length || 0))}
                            </span>
                        </div>
                    )}

                    {/* View More button - wider, shorter, and consistently aligned */}
                    {/* <div className="flex justify-end w-full"> */}
                    <Button
                        variant="default"
                        size="default"
                        onClick={onViewMore}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 py-1 h-auto min-h-[32px]"
                    >
                        View More
                    </Button>
                    {/* </div> */}
                </div>

                {/* View More button for submissions without attachments - wider, shorter, and consistently aligned */}
                {/* {((sub.submission?.attachments?.files?.length || 0) + (sub.submission?.attachments?.images?.length || 0) + (sub.submission?.attachments?.links?.length || 0)) === 0 && (
                    <div className="flex justify-end">
                        <Button
                            variant="default"
                            size="default"
                            onClick={onViewMore}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6 py-1 h-auto min-h-[32px]"
                        >
                            View More
                        </Button>
                    </div>
                )} */}
            </CardContent>
        </Card>
    );
}

export default function StudentSubmissionsPage() {
    const { courseVersionId, cohortName, studentId } = useParams({ strict: false });
    const navigate = useNavigate();

    // Pagination and search state
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const { data: submissions, isLoading: submissionsLoading, error } = useHpStudentSubmissions(
        studentId || "", courseVersionId || "", cohortName || ""
    );
    const { data: stats } = useHpStudentSubmissionStats(
        studentId || "",
        decodeURIComponent(cohortName || "")
    );
    const { data: students, isLoading: studentsLoading } = useHpStudents(courseVersionId || "", cohortName || "");
    const student = students.find(s => s._id === studentId);



    if (error) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>{String(error)}</span>
            </div>
        );
    }


    const safeSubmissions = submissions ?? [];
    console.log("Submissions data here-> ", safeSubmissions);

    // Filter submissions based on search query with prioritized results
    const filteredSubmissions = useMemo(() => {
        if (!searchQuery.trim()) return safeSubmissions;

        const query = searchQuery.toLowerCase();

        // Separate submissions into priority groups
        const startsWithMatches: any[] = [];
        const containsMatches: any[] = [];

        safeSubmissions.forEach((sub: any) => {
            const title = sub.activity?.title || '';
            const description = sub.activity?.description || '';

            const titleStartsWith = title.toLowerCase().startsWith(query);
            const titleContains = title.toLowerCase().includes(query);
            const descriptionContains = description.toLowerCase().includes(query);

            if (titleStartsWith) {
                startsWithMatches.push(sub);
            } else if (titleContains || descriptionContains) {
                containsMatches.push(sub);
            }
        });

        // Return prioritized results: starts with > contains
        return [...startsWithMatches, ...containsMatches];
    }, [safeSubmissions, searchQuery]);

    // Pagination logic
    const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
    const paginatedSubmissions = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredSubmissions.slice(startIndex, endIndex);
    }, [filteredSubmissions, currentPage, itemsPerPage]);

    // Reset page when search or items per page changes
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1);
    };

    const totalActivities = stats?.totalActivities ?? 0;
    const submitted = stats?.totalSubmissions ?? 0;
    const pending = stats?.totalPendings ?? 0;
    const late = stats?.totalLateSubmissions ?? 0;
    const totalCurrentHp = stats?.currentHp ?? 0;
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
            {studentsLoading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-5">
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
                    {/* <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Activity Reward</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {(() => {
                                if (!stats?.reward) return (
                                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                                );
                                const { type, value } = stats.reward;
                                if (type === "ABSOLUTE") return (
                                    <div className="text-2xl font-bold text-muted-foreground flex items-center gap-2">
                                        <Zap className="h-5 w-5 text-yellow-500" />
                                        {value}
                                    </div>
                                );
                                return (
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-2xl font-bold text-muted-foreground flex items-center gap-2">
                                            <Zap className="h-5 w-5 text-yellow-500" />
                                            {type === "PERCENTAGE" ? `${value}%` : value}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            of Current HP ({totalCurrentHp})
                                        </div>
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card> */}
                </div>
            )}

            {/* Search and Pagination Controls */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by activity title..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex items-center gap-2">
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

            {/* Submission Cards */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Activity Submissions</h3>
                    <span className="text-sm text-muted-foreground">
                        Showing {paginatedSubmissions.length} of {filteredSubmissions.length} submissions
                    </span>
                </div>
                {submissionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                ) : safeSubmissions.length === 0 ? (
                    <div className="text-center py-12 border border-dashed rounded-lg">
                        <div className="text-muted-foreground">No submissions found for this student.</div>
                    </div>
                ) : paginatedSubmissions.map((sub: any, index: number) => (
                    <SimplifiedSubmissionCard
                        key={`${sub._id || sub.activity?.id || 'unknown'}-${sub.submission?._id || index}-${currentPage}`}
                        sub={sub}
                        onViewMore={() => navigate({
                            to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || "")}/student/${studentId}/submission/${sub.submission?._id || sub._id}`
                        })}
                    />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <Card>
                    <CardContent className="p-4">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalDocuments={filteredSubmissions.length}
                            onPageChange={setCurrentPage}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
