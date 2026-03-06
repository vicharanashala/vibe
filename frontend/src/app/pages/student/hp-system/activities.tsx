import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentActivities } from "@/hooks/hooks";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    FileText,
    Link as LinkIcon,
    Clock,
    ArrowLeft,
    Paperclip,
} from "lucide-react";
import { HpActivity } from "@/lib/api/hp-system";

export default function StudentActivities() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();

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

    const { data: activities, isLoading, error } = useHpStudentActivities(
        courseVersionId as string,
        cohortName as string
    );

    if (isLoading) {
        return (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[50vh]">
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

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/student/hp-system/cohorts' })}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
                    <p className="text-muted-foreground">
                        {decodeURIComponent(cohortName as string)}
                    </p>
                </div>
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
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t justify-between px-6 py-4">
                                <div className="text-sm text-muted-foreground">
                                    Submission:
                                    <span className="font-medium text-foreground ml-1">
                                        {activity.submissionMode === 'EXTERNAL_LINK' ? 'External Link' : 'In Platform'}
                                    </span>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
