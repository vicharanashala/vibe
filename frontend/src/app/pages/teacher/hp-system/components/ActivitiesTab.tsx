import { useState, useEffect } from "react";
import { HpActivity } from "@/lib/api/hp-system";
import { useNavigate } from "@tanstack/react-router";
import { EditActivityDialog } from "./EditActivityDialog";
import { RuleSettingsDialog } from "./RuleSettingsDialog";
import { useHpActivities, useUpdateHpActivity, usePublishHpActivity, useArchiveHpActivity, useHpCourseVersions, useDeleteHpActivity, useHpActivitiesStatsMap } from "@/hooks/hooks";
import { Plus, Search, Trash2, Paperclip, Edit, Link as LinkIcon, FileText, Send, Settings, LayoutGrid, List, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination } from "@/components/ui/Pagination";


interface ActivitiesTabProps {
    courseVersionId: string;
    cohortName: string;
    courseId?: string;
}

export function ActivitiesTab({ courseVersionId, cohortName }: ActivitiesTabProps) {
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [activityFilter, setActivityFilter] = useState("ALL");
    const [debouncedSearch, setDebouncedSearch] = useState("");


    // Edit Dialog state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<HpActivity | null>(null);

    // Rule Dialog state
    const [isRulesOpen, setIsRulesOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState("");

    const navigate = useNavigate();

    // Hooks
    const { data: courses } = useHpCourseVersions();
    const courseId = courses.find(c =>
        c.versions.some(v => v.courseVersionId === courseVersionId)
    )?.courseId || "000000000000000000000001";
    const { data: activities, isLoading: loading, refetch } = useHpActivities(
        courseVersionId, cohortName, statusFilter, debouncedSearch, activityFilter
    );
    const { mutateAsync: updateActivity } = useUpdateHpActivity();
    const totalPages = Math.ceil((activities?.length || 0) / itemsPerPage);
    const paginatedActivities = (activities || []).slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    const { mutateAsync: publishActivity } = usePublishHpActivity();
    const { mutateAsync: archiveActivity } = useArchiveHpActivity();
    const {mutateAsync: deleteActivity} = useDeleteHpActivity();

    const { data: statsMap } = useHpActivitiesStatsMap(cohortName, courseVersionId);
    console.log("Stats Map:", statsMap);

    // Handle Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleArchive = async (id: string) => {
        if (confirm("Are you sure you want to archive this activity?")) {
            await archiveActivity(id);
            refetch();
        }
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

    const handleDelete = async (id: string) => {
        console.log("Delete activity with id:", id);
        await deleteActivity(id)
        refetch();
    };

    return (
        <TooltipProvider>
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search activities..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
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

                    <Select value={activityFilter} onValueChange={setActivityFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Activity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Activities</SelectItem>
                            <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                            {/* <SelectItem value="MILESTONE">Milestone</SelectItem> */}
                            {/* <SelectItem value="EXTERNAL_IMPORT">External Import</SelectItem> */}
                            <SelectItem value="VIBE_MILESTONE">Vibe Platform Milestone</SelectItem>
                            {/* <SelectItem value="OTHER">Other</SelectItem> */}
                        </SelectContent>
                    </Select>

                    {/* View Toggle */}
                    <div className="flex items-center border rounded-md overflow-hidden">

                        <Button
                            variant={viewMode === "list" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-none h-9 px-3"
                            onClick={() => setViewMode("list")}
                            title="List View"
                        >
                            <List className="h-4 w-4" />
                        </Button>

                        <Button
                            variant={viewMode === "grid" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-none h-9 px-3"
                            onClick={() => setViewMode("grid")}
                            title="Grid View"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>

                    </div>
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
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                    {paginatedActivities.map((activity) => (
                        <Card
                            key={activity._id}
                            className="flex flex-col relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-all"
                        >
                            {/* Top decorative border based on status */}
                            <div className={`h-1 w-full absolute top-0 left-0 ${activity.status === 'PUBLISHED'
                                ? 'bg-emerald-500'
                                : 'bg-amber-400'
                                }`} />

                            <CardHeader className="pb-4 pt-4">
                                <div className="flex flex-col justify-between items-start gap-2">
                                    <div className="flex items-center justify-between gap-4 w-full">
                                        <CardTitle
                                            className="text-lg truncate w-[60%]"
                                            title={activity.title}
                                        >
                                            {activity.title}
                                        </CardTitle>

                                        <div className="flex flex-wrap sm:flex-nowrap gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(activity)}>
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Edit</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            {activity.status !== "ARCHIVED" && <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="outline" size="sm" onClick={() => handleArchive(activity._id)}>
                                                            <Archive className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Archive</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>}

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            disabled={activity.status === "PUBLISHED"}
                                                            onClick={() => handlePublish(activity._id)}
                                                        >
                                                            <Send className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Publish</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedActivityId(activity._id);
                                                                setIsRulesOpen(true);
                                                            }}
                                                        >
                                                            <Settings className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Settings</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            {activity.status === "ARCHIVED" &&<TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                handleDelete(activity._id);
                                                            }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>}
                                        </div>
                                    </div>

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
                            </CardHeader>

                            <CardContent className="flex-1 space-y-4">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {activity.description || "No description provided."}
                                </p>

                                <div className="text-xs space-y-2 mt-4">
                                    <div className="flex items-center text-muted-foreground">
                                        <span className="w-24 font-medium text-foreground">Created By:</span>
                                        <span>{activity.instructorName || `Teacher ID ${activity.createdByTeacherId || "Unknown"}`}</span>
                                    </div>
                                    {activity.rules && (
                                        <>
                                            <div className="flex items-center text-muted-foreground">
                                                <span className="w-24 font-medium text-foreground">Mandatory:</span>
                                                <span>{activity.rules.isMandatory ? 'Yes' : 'No'}</span>
                                            </div>
                                            {activity.rules.deadlineAt && (
                                                <div className="flex items-center text-muted-foreground">
                                                    <span className="w-24 font-medium text-foreground">Deadline:</span>
                                                    <span>{new Date(activity.rules.deadlineAt).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <div className="flex items-center text-muted-foreground">
                                        <span className="w-24 font-medium text-foreground">Submission:</span>
                                        <span>{(activity.submissionMode || "").replace('_', ' ')}</span>
                                    </div>
                                    <div className="flex items-start text-muted-foreground">
                                        <span className="w-24 font-medium text-foreground whitespace-nowrap mt-0.5">Attachments:</span>
                                        
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
                                    {activity.submissionMode === 'EXTERNAL_LINK' && activity.externalLink && (
                                        <div className="flex items-start text-muted-foreground">
                                            <span className="w-24 font-medium text-foreground whitespace-nowrap mt-0.5">Ext. Link:</span>
                                            <a
                                                href={activity.externalLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline hover:text-blue-800 text-xs truncate max-w-[200px]"
                                            >
                                                {activity.externalLink}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Stats block from backend */}
                                <div className="bg-muted/30 p-3 rounded-md flex justify-between items-center mt-4 border text-xs">
                                    <div className="text-center px-2">
                                        <div className="font-bold text-foreground">{(Number(statsMap?.[activity._id]?.approvedCount) + Number(statsMap?.[activity._id]?.rejectedCount) + Number(statsMap?.[activity._id]?.submittedCount)+ Number(statsMap?.[activity._id]?.revertedCount)) || 0}</div>
                                        <div className="text-muted-foreground">Total Submitted</div>
                                    </div>
                                    <div className="w-px h-8 bg-border" />
                                    <div className="text-center px-2">
                                        <div className="font-bold text-foreground">{(Number(statsMap?.[activity._id]?.rejectedCount) + Number(statsMap?.[activity._id]?.submittedCount)+ Number(statsMap?.[activity._id]?.revertedCount)) || 0}</div>
                                        <div className="text-muted-foreground">Overdue</div>
                                    </div>
                                    <div className="w-px h-8 bg-border" />
                                    <div className="text-center px-2">
                                        <div className="font-bold text-green-600">{(Number(statsMap?.[activity._id]?.approvedCount)) || 0}</div>
                                        <div className="text-muted-foreground">Completed</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                // ─── LIST VIEW ───
                <div className="flex flex-col gap-3">
                    {paginatedActivities.map((activity) => (
                        <Card key={activity._id} className="relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-all">
                            <div className={`w-1 h-full absolute top-0 left-0 ${activity.status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 pl-8">
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-base truncate">{activity.title}</span>
                                        <Badge variant="outline" className="bg-muted/50 text-muted-foreground text-xs">{activity.activityType}</Badge>
                                        <Badge variant={activity.status === "PUBLISHED" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wide font-medium">
                                            {activity.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-1">{activity.description || "No description provided."}</p>
                                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1">
                                        <span><span className="font-medium text-foreground">By:</span> {activity.instructorName || "Unknown"}</span>
                                        {activity.rules?.deadlineAt && (
                                            <span><span className="font-medium text-foreground">Deadline:</span> {new Date(activity.rules.deadlineAt).toLocaleDateString()}</span>
                                        )}
                                        <span><span className="font-medium text-foreground">Submission:</span> {(activity.submissionMode || "").replace('_', ' ')}</span>
                                        <span><span className="font-medium text-foreground">Total Submitted:</span> {(Number(statsMap?.[activity._id]?.approvedCount) + Number(statsMap?.[activity._id]?.rejectedCount) + Number(statsMap?.[activity._id]?.submittedCount)+ Number(statsMap?.[activity._id]?.revertedCount)) || 0}</span>
                                        <span><span className="font-medium text-foreground">Overdue:</span> {(Number(statsMap?.[activity._id]?.rejectedCount) + Number(statsMap?.[activity._id]?.submittedCount)+ Number(statsMap?.[activity._id]?.revertedCount)) || 0}</span>
                                        <span className="text-green-600"><span className="font-medium">Completed:</span> {(Number(statsMap?.[activity._id]?.approvedCount)) || 0}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap sm:flex-nowrap justify-end gap-2">
                                    <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => handleOpenEdit(activity)}>
                                        <Edit className="mr-2 h-3.5 w-3.5" /> Edit
                                    </Button>
                                    {activity.status !== "ARCHIVED" && (
                                        <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => handleArchive(activity._id)}>
                                            <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                                        </Button>
                                    )}

                                    <Button size="sm" variant="outline" className="h-9 px-4" disabled={activity.status === 'PUBLISHED'} onClick={() => handlePublish(activity._id)}>
                                        <Send className="mr-2 h-3.5 w-3.5" /> Publish
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => { setSelectedActivityId(activity._id); setIsRulesOpen(true); console.log("Opening rule settings for activity:", activity._id) }}>
                                        <Settings className="mr-2 h-3.5 w-3.5" /> Rules
                                    </Button>
                                    {activity.status === "ARCHIVED" && (
                                        <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => { handleDelete(activity._id); }}>
                                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {activities && activities.length > 0 && (
                <Card>
                    <CardContent className="p-3">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalDocuments={activities?.length || 0}
                            onPageChange={setCurrentPage}
                        />
                    </CardContent>
                </Card>
            )}

            <EditActivityDialog
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
                activity={editingActivity}
                onSubmit={handleEditSubmit}
            />

            <RuleSettingsDialog
                isOpen={isRulesOpen}
                onOpenChange={setIsRulesOpen}
                courseId={courseId}
                courseVersionId={courseVersionId}
                activityId={selectedActivityId}
            />
        </div>
        </TooltipProvider>
    );
}
