import { useState, useCallback } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentSubmissions, useHpStudents } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
    ArrowLeft, Clock, FileText, CheckCircle, AlertCircle, XCircle,
    CalendarClock, Timer, Zap
} from "lucide-react";
import type { HpStudentSubmission } from "@/lib/api/hp-system";

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

function SimplifiedSubmissionCard({ sub, onViewMore }: { sub: HpStudentSubmission; onViewMore: () => void }) {
    const [isTextExpanded, setIsTextExpanded] = useState(false);
    const status = sub.status || 'PENDING';
    const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const StatusIcon = cfg.icon;
    
    const textResponse = sub.submission?.attachments?.textResponse || '';
    const shouldShowExpandable = textResponse && textResponse.length > 100;
    const displayText = isTextExpanded ? textResponse : textResponse.substring(0, 100);
    
    const toggleTextExpansion = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsTextExpanded(!isTextExpanded);
    }, [isTextExpanded]);

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
                                    Submitted: {formatDate(sub.submittedAt)}
                                </span>
                            )}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* HP badges */}
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
                        {sub.isLate && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/20 cursor-default">
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
                <div className="flex items-center justify-between">
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
                    <Button
                        variant="default"
                        size="default"
                        onClick={onViewMore}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 py-1 h-auto w-100 min-h-[32px]"
                    >
                        View More
                    </Button>
                </div>

                {/* View More button for submissions without attachments - wider, shorter, and consistently aligned */}
                {((sub.submission?.attachments?.files?.length || 0) + (sub.submission?.attachments?.images?.length || 0) + (sub.submission?.attachments?.links?.length || 0)) === 0 && (
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
                )}
            </CardContent>
        </Card>
    );
}

export default function StudentSubmissionsPage() {
    const { courseVersionId, cohortName, studentId } = useParams({ strict: false });
    const navigate = useNavigate();
    const { data: submissions, isLoading: submissionsLoading, error } = useHpStudentSubmissions(
    studentId || "", courseVersionId || "", cohortName || ""
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
    const totalActivities = safeSubmissions.length;
    const submitted = safeSubmissions.filter((s: any) => s.submission?.status === "SUBMITTED").length;
    const pending = safeSubmissions.filter((s: any) => s.submission?.status === "PENDING").length;
    const late = safeSubmissions.filter((s: any) => s.submission?.isLate).length;
    const totalCurrentHp = safeSubmissions.reduce((sum: number, s: any) => sum + (s.hp?.currentHp || 0), 0);
    const totalBaseHp = safeSubmissions.reduce((sum: number, s: any) => sum + (s.hp?.baseHp || 0), 0);
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
                ) : safeSubmissions.map((sub: any) => (
                    <SimplifiedSubmissionCard
                        key={sub._id || sub.activity?.id}
                        sub={sub}
                        onViewMore={() => navigate({
                            to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || "")}/student/${studentId}/submission/${sub.submission?._id || sub._id}`
                        })}
                    />
                ))}
            </div>
        </div>
    );
}
