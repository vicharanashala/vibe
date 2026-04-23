// @ts-nocheck

import { useState, useMemo } from "react";
import { HpActivity } from "@/lib/api/hp-system";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { EditActivityDialog } from "./EditActivityDialog";
import { RuleSettingsDialog } from "./RuleSettingsDialog";
import { useHpActivities, useUpdateHpActivity, usePublishHpActivity, useArchiveHpActivity, useHpCourseVersions, useDeleteHpActivity, useHpActivitiesStatsMap } from "@/hooks/hooks";
import { Plus, Search, Trash2, Paperclip, Edit, Link as LinkIcon, FileText, Send, Settings, LayoutGrid, List, Archive, RefreshCw, MoreVertical } from "lucide-react";
import{
    DropdownMenu,
        DropdownMenuTrigger,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuSeparator,
}from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination } from "@/components/ui/Pagination";
import ConfirmationModal from "../../components/confirmation-modal";


interface ActivitiesTabProps {
    courseVersionId: string;
    cohortId: string;
    courseId?: string;
}

export function ActivitiesTab({ courseVersionId, cohortId }: ActivitiesTabProps) {
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [activityFilter, setActivityFilter] = useState("ALL");
    
    const router = useRouterState();
    const from = router.location.state?.from;


    // Edit Dialog state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<HpActivity | null>(null);

    // Rule Dialog state
    const [isRulesOpen, setIsRulesOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState("");

    // Confirmation Modal state
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => Promise<void>;
        isDestructive?: boolean;
        isLoading?: boolean;
    }>({
        isOpen: false,
        title: "",
        description: "",
        onConfirm: async () => { },
    });

    const navigate = useNavigate();

    // Hooks
    const { data: courses } = useHpCourseVersions();
    const courseId = courses.find(c =>
        c.versions.some(v => v.courseVersionId === courseVersionId)
    )?.courseId || "000000000000000000000001";
    const { data: activities, isLoading: loading, refetch, isRefetching } = useHpActivities(
        courseVersionId, cohortId, statusFilter, "", activityFilter
    );
    
    // Client-side filtering based only on activity title
    const filteredActivities = useMemo(() => {
        if (!search.trim()) return activities || [];
        
        const query = search.toLowerCase();
        
        // Separate activities into priority groups
        const startsWithMatches: any[] = [];
        const containsMatches: any[] = [];
        
        (activities || []).forEach((activity: any) => {
            const title = activity.title || '';
            
            const titleStartsWith = title.toLowerCase().startsWith(query);
            const titleContains = title.toLowerCase().includes(query);
            
            if (titleStartsWith) {
                startsWithMatches.push(activity);
            } else if (titleContains) {
                containsMatches.push(activity);
            }
        });
        
        // Return prioritized results: starts with > contains
        return [...startsWithMatches, ...containsMatches];
    }, [activities, search]);
    
    const { mutateAsync: updateActivity } = useUpdateHpActivity();
    const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
    const paginatedActivities = filteredActivities.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    const { mutateAsync: publishActivity } = usePublishHpActivity();
    const { mutateAsync: archiveActivity } = useArchiveHpActivity();
    const {mutateAsync: deleteActivity} = useDeleteHpActivity();

    // const { data: statsMap } = useHpActivitiesStatsMap(cohortId, courseVersionId);
    // console.log("Stats Map:", statsMap);

    // Handle Search Debounce
    // useEffect(() => {
    //     const timer = setTimeout(() => {
    //         setDebouncedSearch(search);
    //     }, 500);
    //     return () => clearTimeout(timer);
    // }, [search]);
    // Handle search change (immediate since we're doing client-side filtering)
    const handleSearchChange = (value: string) => {
        setSearch(value);
        setCurrentPage(1); // Reset page when search changes
    };
    
    // Handle items per page change
    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1);
    };

    const handleArchive = (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: "Archive Activity",
            description: "Are you sure you want to archive this activity? It will be removed from the active list for students.",
            onConfirm: async () => {
                try {
                    setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                    await archiveActivity(id);
                    refetch();
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
                }
            }
        });
    };


    const handleOpenEdit = (activity: HpActivity) => {
        setEditingActivity(activity);
        setIsEditOpen(true);
    };

    const handleEditSubmit = async (id: string, updates: Partial<HpActivity>) => {
        await updateActivity(id, updates);
        refetch();
    };

    const handlePublish = (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: "Publish Activity",
            description: "Are you sure you want to publish this activity? It will become visible to all students in the cohort.",
            onConfirm: async () => {
                try {
                    setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                    await publishActivity(id);
                    refetch();
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
                }
            }
        });
    };

    const handleDelete = (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Activity",
            description: "Are you sure you want to permanently delete this activity? This action cannot be undone.",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                    await deleteActivity(id);
                    refetch();
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
                }
            }
        });
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
                            onChange={(e) => handleSearchChange(e.target.value)}
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
                    
                    {/* Items per page selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Show:</span>
                        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                            <SelectTrigger className="w-[80px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="6">6</SelectItem>
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
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isRefetching || loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                        {isRefetching ? "Refreshing..." : "Refresh"}
                    </Button>
                    <Button onClick={() => navigate({ to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortId)}/activities/create` , state: {from}})}>
                        <Plus className="mr-2 h-4 w-4" /> Add Activity
                    </Button>
                </div>
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

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onSelect={() => handleOpenEdit(activity)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                {activity.status !== "ARCHIVED" && (
                                                    <DropdownMenuItem onSelect={() => handleArchive(activity._id)}>
                                                        <Archive className="mr-2 h-4 w-4" /> Archive
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onSelect={() => handlePublish(activity._id)}
                                                    disabled={activity.status === "PUBLISHED"}
                                                >
                                                    <Send className="mr-2 h-4 w-4" /> Publish
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => { setSelectedActivityId(activity._id); setIsRulesOpen(true); }}>
                                                    <Settings className="mr-2 h-4 w-4" /> Rules
                                                </DropdownMenuItem>
                                                {activity.status === "ARCHIVED" && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onSelect={() => handleDelete(activity._id)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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
                                {/* <div className="bg-muted/30 p-3 rounded-md flex justify-between items-center mt-4 border text-xs">
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
                                </div> */}
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
                                        {/* <span><span className="font-medium text-foreground">Total Submitted:</span> {(Number(statsMap?.[activity._id]?.approvedCount) + Number(statsMap?.[activity._id]?.rejectedCount) + Number(statsMap?.[activity._id]?.submittedCount)+ Number(statsMap?.[activity._id]?.revertedCount)) || 0}</span>
                                        <span><span className="font-medium text-foreground">Overdue:</span> {(Number(statsMap?.[activity._id]?.rejectedCount) + Number(statsMap?.[activity._id]?.submittedCount)+ Number(statsMap?.[activity._id]?.revertedCount)) || 0}</span>
                                        <span className="text-green-600"><span className="font-medium">Completed:</span> {(Number(statsMap?.[activity._id]?.approvedCount)) || 0}</span> */}
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 px-3">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onSelect={() => handleOpenEdit(activity)}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        {activity.status !== "ARCHIVED" && (
                                            <DropdownMenuItem onSelect={() => handleArchive(activity._id)}>
                                                <Archive className="mr-2 h-4 w-4" /> Archive
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                            onSelect={() => handlePublish(activity._id)}
                                            disabled={activity.status === "PUBLISHED"}
                                        >
                                            <Send className="mr-2 h-4 w-4" /> Publish
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => { setSelectedActivityId(activity._id); setIsRulesOpen(true); }}>
                                            <Settings className="mr-2 h-4 w-4" /> Rules
                                        </DropdownMenuItem>
                                        {activity.status === "ARCHIVED" && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onSelect={() => handleDelete(activity._id)}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {activities && activities.length > itemsPerPage && (
                <Card>
                    <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">
                                Showing {paginatedActivities.length} of {activities?.length || 0} activities
                            </span>
                        </div>
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
                cohortId={cohortId}
                activityId={selectedActivityId}
            />

            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                description={confirmConfig.description}
                isDestructive={confirmConfig.isDestructive}
                isLoading={confirmConfig.isLoading}
                confirmText={confirmConfig.isDestructive ? "Delete" : "Confirm"}
            />
        </div>
        </TooltipProvider>
    );
}
