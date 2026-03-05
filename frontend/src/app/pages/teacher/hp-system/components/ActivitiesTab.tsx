import { useState, useEffect } from "react";
import { HpActivity } from "@/lib/api/hp-system";
import { useHpActivities, useUpdateHpActivity, usePublishHpActivity, useArchiveHpActivity } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, Search, Trash2, Settings, Paperclip, Edit, Link as LinkIcon, FileText, Send } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { RuleSettingsDialog } from "./RuleSettingsDialog";
import { EditActivityDialog } from "./EditActivityDialog";

interface ActivitiesTabProps {
    courseVersionId: string;
    cohortName: string;
    courseId?: string;
}

export function ActivitiesTab({ courseVersionId, cohortName }: ActivitiesTabProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Setting Dialog state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<HpActivity | null>(null);

    // Edit Dialog state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<HpActivity | null>(null);

    const navigate = useNavigate();

    // Hooks
    const { data: activities, isLoading: loading, refetch } = useHpActivities(
        courseVersionId, cohortName, statusFilter, debouncedSearch
    );
    const { mutateAsync: updateActivity } = useUpdateHpActivity();
    const { mutateAsync: publishActivity } = usePublishHpActivity();
    const { mutateAsync: archiveActivity } = useArchiveHpActivity();

    // Handle Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this activity?")) {
            await archiveActivity(id);
            refetch();
        }
    };

    const handleOpenSettings = (activity: HpActivity) => {
        setSelectedActivity(activity);
        setIsSettingsOpen(true);
    };

    const handleOpenEdit = (activity: HpActivity) => {
        setEditingActivity(activity);
        setIsEditOpen(true);
    };

    const handleEditSubmit = async (id: string, updates: Partial<HpActivity>) => {
        await updateActivity(id, updates);
        refetch();
    };

    const handlePublish = async (id: string) => {
        await publishActivity(id);
        refetch();
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search activities..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="PUBLISHED">Published</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => navigate({ to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName)}/activities/create` })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Activity
                </Button>
            </div>

            {loading ? (
                <div className="w-full h-32 flex items-center justify-center text-muted-foreground border rounded-md">
                    Loading activities...
                </div>
            ) : activities.length === 0 ? (
                <div className="w-full h-32 flex items-center justify-center text-muted-foreground border rounded-md">
                    No activities found.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                    {activities.map((activity) => (
                        <Card
                                key={activity._id}
                                className="flex flex-col relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-all"
                            >
                            {/* Top decorative border based on status */}
                           <div className={`h-1 w-full absolute top-0 left-0 ${
                                            activity.status === 'PUBLISHED'
                                                ? 'bg-emerald-500'
                                                : 'bg-amber-400'
                                            }`} />

                            <CardHeader className="pb-4 pt-6">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                    <CardTitle
                                        className="text-lg line-clamp-1"
                                        title={activity.title}
                                    >
                                        {activity.title}
                                    </CardTitle>

                                    <div className="flex gap-2 text-xs">
                                        <Badge
                                        variant="outline"
                                        className="bg-muted/50 text-muted-foreground"
                                        >
                                        {activity.activityType}
                                        </Badge>

                                        <Badge
                                        variant={
                                            activity.status === "PUBLISHED"
                                            ? "default"
                                            : "secondary"
                                        }
                                        className="text-[10px] uppercase tracking-wide font-medium"
                                        >
                                        {activity.status}
                                        </Badge>
                                    </div>
                                    </div>
                                </div>
                                </CardHeader>

                            <CardContent className="flex-1 space-y-4">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {activity.description || "No description provided."}
                                </p>

                                <div className="text-xs space-y-2 mt-4">
                                    <div className="flex items-center text-muted-foreground">
                                        <span className="w-24 font-medium text-foreground">Created By:</span>
                                        <span>Teacher ID {activity.createdByTeacherId || "Unknown"}</span>
                                    </div>
                                    <div className="flex items-center text-muted-foreground">
                                        <span className="w-24 font-medium text-foreground">Submission:</span>
                                        <span>{activity.submissionMode.replace('_', ' ')}</span>
                                    </div>
                                    <div className="flex items-start text-muted-foreground">
                                        <span className="w-24 font-medium text-foreground whitespace-nowrap mt-0.5">Attachments:</span>
                                        <div className="flex flex-col gap-1 w-full">
                                            {(!activity.attachments || activity.attachments.length === 0) ? (
                                                <span className="flex items-center gap-1 text-xs">
                                                    <Paperclip className="h-3 w-3" /> None
                                                </span>
                                            ) : (
                                                activity.attachments.map((att, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 text-blue-600 hover:underline hover:text-blue-800 text-xs w-fit max-w-full"
                                                    >
                                                        {att.kind === 'PDF' ? <FileText className="h-3 w-3 flex-shrink-0" /> : <LinkIcon className="h-3 w-3 flex-shrink-0" />}
                                                        <span className="truncate">{att.name}</span>
                                                    </a>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats block from backend */}
                                <div className="bg-muted/30 p-3 rounded-md flex justify-between items-center mt-4 border text-xs">
                                    <div className="text-center px-2">
                                        <div className="font-bold text-foreground">{activity.stats?.submittedCount ?? 0}/{activity.stats?.totalStudents ?? 0}</div>
                                        <div className="text-muted-foreground">Submitted</div>
                                    </div>
                                    <div className="w-px h-8 bg-border" />
                                    <div className="text-center px-2">
                                        <div className="font-bold text-foreground">{activity.stats?.overdueCount ?? 0}</div>
                                        <div className="text-muted-foreground">Overdue</div>
                                    </div>
                                    <div className="w-px h-8 bg-border" />
                                    <div className="text-center px-2">
                                        <div className="font-bold text-green-600">{activity.stats?.completedCount ?? 0}</div>
                                        <div className="text-muted-foreground">Completed</div>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="pt-4 pb-4 border-t">
                                <div className="flex flex-wrap sm:flex-nowrap justify-end gap-2 w-full">

                                    <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 px-4"
                                            onClick={() => handleOpenEdit(activity)}
                                        >
                                    <Edit className="mr-2 h-3.5 w-3.5" /> Edit
                                    </Button>

                                    <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-9 px-4"
                                            onClick={() => handleDelete(activity._id)}
                                        >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                    </Button>

                                   <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-9 px-4"
                                        disabled={activity.status === 'PUBLISHED'}
                                        onClick={() => handlePublish(activity._id)}
                                        >
                                        <Send className="mr-2 h-3.5 w-3.5" />
                                        Publish
                                    </Button>

                                    <Button
                                            size="sm"
                                            className="h-9 px-4"
                                            onClick={() => handleOpenSettings(activity)}
                                        >
                                    <Settings className="mr-2 h-3.5 w-3.5" /> Rules
                                    </Button>

                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <EditActivityDialog
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
                activity={editingActivity}
                onSubmit={handleEditSubmit}
            />

            {selectedActivity && (
                <RuleSettingsDialog
                    isOpen={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                    courseVersionId={courseVersionId}
                    cohort={cohortName}
                    ruleConfigId={selectedActivity._id}
                    activityId={selectedActivity._id}
                />
            )}
        </div>
    );
}
