import { useParams, useNavigate } from "@tanstack/react-router";
import { useStudentMySubmissions } from "@/hooks/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Link as LinkIcon, FileText, Clock } from "lucide-react";

export default function StudentSubmissions() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();

    const { data: submissions, isLoading, error } = useStudentMySubmissions(
        courseVersionId as string,
        cohortName as string
    );

    const formatDateTime = (dateString: string) => {
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

    if (isLoading) {
        return (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading your submissions...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-destructive">
                Error loading submissions. Please try again later.
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUBMITTED':
                return <Badge className="bg-blue-500">Submitted</Badge>;
            case 'APPROVED':
            case 'GRADED':
                return <Badge className="bg-green-500">Approved</Badge>;
            case 'REJECTED':
            case 'REVERTED':
                return <Badge variant="destructive">Reverted</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/activities` })}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Submissions</h1>
                    <p className="text-muted-foreground">
                        {decodeURIComponent(cohortName as string)}
                    </p>
                </div>
            </div>

            {(!submissions || submissions.length === 0) ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No Submissions Found</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                        You have not made any activity submissions for this cohort yet.
                    </p>
                    <Button
                        variant="outline"
                        className="mt-6"
                        onClick={() => navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/activities` })}
                    >
                        View Activities
                    </Button>
                </Card>
            ) : (
                <div className="space-y-4">
                    {submissions.map((sub: any) => (
                        <Card key={sub.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <CardTitle className="text-lg">
                                            {sub.activity?.title || "Unknown Activity"}
                                        </CardTitle>
                                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>Submitted: {formatDateTime(sub.submission.submittedAt)}</span>
                                        </div>
                                    </div>
                                    {getStatusBadge(sub.submission.status)}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                {/* Text Response */}
                                {sub.submission.attachments?.textResponse && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Response</h4>
                                        <div className="bg-muted/50 p-4 rounded-md text-sm whitespace-pre-wrap border">
                                            {sub.submission.attachments.textResponse}
                                        </div>
                                    </div>
                                )}

                                {/* Links */}
                                {sub.submission.attachments?.links && sub.submission.attachments.links.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Submitted Links</h4>
                                        <div className="flex flex-col gap-2">
                                            {sub.submission.attachments.links.map((link: any, idx: number) => (
                                                <a
                                                    key={idx}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 p-2 rounded border hover:bg-muted transition-colors text-sm text-blue-600 dark:text-blue-400"
                                                >
                                                    <LinkIcon className="h-4 w-4 shrink-0" />
                                                    <span className="truncate">{link.label || link.url}</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Attachments */}
                                {((sub.submission.attachments?.files && sub.submission.attachments.files.length > 0) ||
                                    (sub.submission.attachments?.images && sub.submission.attachments.images.length > 0)) && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Attachments</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {sub.submission.attachments.files?.map((att: any, idx: number) => (
                                                    <a
                                                        key={`file-${idx}`}
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 p-2 rounded border bg-muted/30 hover:bg-muted transition-colors text-sm"
                                                    >
                                                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        <span className="truncate max-w-[200px]">{att.name}</span>
                                                    </a>
                                                ))}
                                                {sub.submission.attachments.images?.map((att: any, idx: number) => (
                                                    <a
                                                        key={`img-${idx}`}
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 p-2 rounded border bg-muted/30 hover:bg-muted transition-colors text-sm"
                                                    >
                                                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        <span className="truncate max-w-[200px]">{att.name}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                {/* Feedback Section */}
                                {sub.instructorFeedback && (
                                    <div className="mt-6 pt-4 border-t">
                                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Instructor Note</h4>
                                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-md text-sm border border-blue-100 dark:border-blue-900/50">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-semibold">{sub.instructorFeedback.decision}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDateTime(sub.instructorFeedback.reviewedAt)}
                                                </span>
                                            </div>
                                            <p>{sub.instructorFeedback.note}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
