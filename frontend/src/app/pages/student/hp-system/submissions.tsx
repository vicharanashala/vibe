import { useState, useMemo } from "react";
import { useParams, useNavigate, useRouterState } from "@tanstack/react-router";
import { useHpCourseVersions, useStudentMySubmissions, useUpdateActivitySubmission } from "@/hooks/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmissionStatusBadge } from "@/components/hp-system/SubmissionStatusBadge";
import { Eye, ChevronDown, ChevronUp, Search, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/Pagination";
import { ArrowLeft, Loader2, Link as LinkIcon, FileText, Clock, Edit, Plus, Trash2, Send } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CourseWithVersions, CourseVersionStats, getEffectiveIds, SubmissionField } from "@/lib/api/hp-system";

export default function StudentSubmissions() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();
    const router = useRouterState();
    const from = router.location.state?.from;
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

    // Pagination and search state
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const { data: submissions, isLoading, error, refetch, isRefetching } = useStudentMySubmissions(
        courseVersionId as string,
        cohortName as string
    );
    const { mutateAsync: updateSubmission, isPending: isUpdating } = useUpdateActivitySubmission();
    const { data: courses = [] } = useHpCourseVersions();
    // courseVersionId is passed from the URL
    const course = courses.find((c: CourseWithVersions) =>
        c.versions.some((v: CourseVersionStats) => v.courseVersionId === courseVersionId)
    );
    const resolvedCourseId = course?.courseId;

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingSubmission, setEditingSubmission] = useState<any | null>(null);
    const [editTextResponse, setEditTextResponse] = useState("");
    const [editLinks, setEditLinks] = useState<{ url: string; label: string }[]>([]);
    const [editFiles, setEditFiles] = useState<File[]>([]);
    const [editImages, setEditImages] = useState<File[]>([]);
    const [existingFiles, setExistingFiles] = useState<any[]>([]);
    const [existingImages, setExistingImages] = useState<any[]>([]);
    const [editError, setEditError] = useState<string | null>(null);

    const getValidation = (sub: any): SubmissionField[] => {
        return sub?.rule?.submissionValidation ?? [SubmissionField.TEXT];
    };

    const validation = getValidation(editingSubmission);

    const isTextRequired = validation.includes(SubmissionField.TEXT);
    const isPdfRequired = validation.includes(SubmissionField.PDF);
    const isImageRequired = validation.includes(SubmissionField.IMAGE);
    const isUrlRequired = validation.includes(SubmissionField.URL);

    const toggleExpanded = (submissionId: string) => {
        setExpandedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(submissionId)) {
                newSet.delete(submissionId);
            } else {
                newSet.add(submissionId);
            }
            return newSet;
        });
    };

    // Pagination logic
    const filteredSubmissions = useMemo(() => {
        if (!submissions) return [];
        return submissions.filter((sub: any) =>
            sub.activity?.title?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [submissions, searchQuery]);

    const paginatedSubmissions = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredSubmissions.slice(startIndex, endIndex);
    }, [filteredSubmissions, currentPage, itemsPerPage]);

    console.log("PaginatedSubmissions -> ", paginatedSubmissions)

    const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1); // Reset to first page when searching
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page when changing items per page
    };

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

    const openEditDialog = (sub: any) => {
        setEditingSubmission(sub);
        setEditTextResponse(sub.submission?.attachments?.textResponse || "");
        setEditLinks((sub.submission?.attachments?.links || []).map((link: any) => ({
            url: link?.url || "",
            label: link?.label || ""
        })));
        setExistingFiles(sub.submission?.attachments?.files || []);
        setExistingImages(sub.submission?.attachments?.images || []);
        setEditFiles([]);
        setEditImages([]);
        setEditError(null);
        setEditDialogOpen(true);
    };

    const addEditLink = () => setEditLinks([...editLinks, { url: "", label: "" }]);

    const updateEditLink = (index: number, field: "url" | "label", value: string) => {
        const updated = [...editLinks];
        updated[index][field] = value;
        setEditLinks(updated);
    };

    const removeEditLink = (index: number) => setEditLinks(editLinks.filter((_, i) => i !== index));

    const isValidSubmission =
        (!isTextRequired || editTextResponse.trim()) &&
        (!isPdfRequired || (existingFiles.length + editFiles.length) > 0) &&
        (!isImageRequired || (existingImages.length + editImages.length) > 0) &&
        (!isUrlRequired || editLinks.some(l => l.url.trim()));

    const handleUpdateSubmission = async () => {
        if (!editingSubmission || !courseVersionId || !cohortName) return;
        setEditError(null);

        const validLinks = editLinks.filter(l => l.url.trim() !== "");

        const totalFiles = existingFiles.length + editFiles.length;
        const totalImages = existingImages.length + editImages.length;

        if (isTextRequired && !editTextResponse.trim()) {
            setEditError("Text response is required");
            return;
        }

        if (isPdfRequired && totalFiles === 0) {
            setEditError("At least one PDF file is required");
            return;
        }

        if (isImageRequired && totalImages === 0) {
            setEditError("At least one image is required");
            return;
        }

        if (isUrlRequired && validLinks.length === 0) {
            setEditError("At least one URL is required");
            return;
        }
        const hasText = editTextResponse.trim() !== "";
        if (!hasText) {
            setEditError("Please provide a text response.");
            return;
        }

        const submissionId = editingSubmission.submission?._id || editingSubmission.id || editingSubmission._id;
        const activityId = editingSubmission.activity?.id || editingSubmission.activity?._id || editingSubmission.activityId;
        
        // Resolve courseId using the getEffectiveIds utility
        const effectiveIds = getEffectiveIds(cohortName as string, resolvedCourseId as string, courseVersionId as string);
        const courseId = effectiveIds.courseId || editingSubmission.activity?.courseId || editingSubmission.courseId || editingSubmission.submission?.courseId;

        if (!submissionId || !activityId || !courseId) {
            console.error("Missing Update Info:", { submissionId, activityId, courseId, editingSubmission, resolvedCourseId });
            setEditError("Missing required information to update this submission.");
            return;
        }

        try {
            await updateSubmission({
                submissionId,
                courseId,
                courseVersionId: courseVersionId as string,
                cohort: cohortName as string,
                activityId,
                payload: {
                    textResponse: editTextResponse.trim() || undefined,
                    links: validLinks.length > 0 ? validLinks : undefined,
                    files: existingFiles.length > 0 ? existingFiles.map((f: any) => ({
                        fileId: f.fileId || f._id || "unknown",
                        url: f.url || "",
                        name: f.name || "File",
                        mimeType: f.mimeType || "application/pdf",
                        sizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : 0,
                    })) : undefined,
                    images: existingImages.length > 0 ? existingImages.map((img: any) => ({
                        fileId: img.fileId || img._id || "unknown",
                        url: img.url || "",
                        name: img.name || "Image"
                    })) : undefined,
                },
                submissionSource: "IN_PLATFORM",
                files: editFiles.length > 0 ? editFiles : undefined,
                images: editImages.length > 0 ? editImages : undefined,
            });
            setEditDialogOpen(false);
            setEditingSubmission(null);
        } catch (err: any) {
            setEditError(err.message || "Failed to update submission");
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

    return (
        <TooltipProvider>
            <div className="container mx-auto p-6 max-w-5xl space-y-6">
                <div className="flex items-center gap-4 mb-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/activities`,state:{from} })}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold tracking-tight">My Submissions</h1>
                        <p className="text-muted-foreground">
                            {decodeURIComponent(cohortName as string)}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isRefetching}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                        {isRefetching ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>

                {(!submissions || submissions.length === 0) ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium">No Submissions Found</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                            You have not made any activity submissions for this cohort yet.
                        </p>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="mt-6"
                                    onClick={() => navigate({ to: `/student/hp-system/${courseVersionId}/${cohortName}/activities`,state:{from} })}
                                >
                                    View Activities
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Go back to activities and submit your work</TooltipContent>
                        </Tooltip>
                    </Card>
                ) : (
                    <>
                        {/* Search and Pagination Controls */}
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-6">
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
                        
                        <div className="space-y-4">
                            {paginatedSubmissions.map((sub: any) => {
                                const containerKey = sub.id || sub._id || sub.submission?._id || Math.random().toString(36);
                                return (
                                <Card key={containerKey} className="overflow-hidden">
                                    <CardHeader className="">
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

                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex items-center flex-row gap-8 mb-2">
                                                <SubmissionStatusBadge className="min-w-[140px] text-base py-1" status={sub.submission.status} rule = {sub.rule.reward.applyWhen}/>
                                                {sub.hp && (
                                                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                                                        <span className="font-medium text-base">{sub.hp.currentHp || 0}/{sub.hp.baseHp || 0} HP</span>
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                onClick={() => toggleExpanded(sub.id || sub._id || sub.submission?._id)}
                                                variant="default"
                                                size="sm"
                                                className="flex items-center gap-2 min-w-[250px] bg-primary text-primary-foreground hover:bg-primary/90"
                                            >
                                                {expandedCards.has(sub.id || sub._id || sub.submission?._id) ? (
                                                    <>
                                                        <ChevronUp className="h-4 w-4" />
                                                        Hide Details
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="h-4 w-4" />
                                                        View Details
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                    </div>
                                </CardHeader>
                                {expandedCards.has(sub.id || sub._id || sub.submission?._id) && (
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
                                        {(sub.instructorFeedback || sub.review) && (
                                            <div className="mt-6 pt-4 border-t">
                                                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Instructor Note</h4>
                                                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-md text-sm border border-blue-100 dark:border-blue-900/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold">{sub.instructorFeedback?.decision || sub.review?.decision}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDateTime(sub.instructorFeedback?.reviewedAt || sub.review?.reviewedAt)}
                                                        </span>
                                                    </div>
                                                    <p>{sub.instructorFeedback?.note || sub.review?.note}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Additional Feedback */}
                                        {sub.feedbacks && sub.feedbacks.length > 0 && (
                                            <div className="mt-6 pt-4 border-t">
                                                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Additional Feedback</h4>
                                                <div className="space-y-3">
                                                    {sub.feedbacks.map((feedback: any, idx: number) => (
                                                        <div key={idx} className="bg-green-50/50 dark:bg-green-900/10 p-4 rounded-md text-sm border border-green-100 dark:border-green-900/50">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                                                        {feedback.username || 'Anonymous'}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {feedback.email || 'N/A'}
                                                                    </div>
                                                                </div>
                                                                {feedback.feedbackAt && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {new Date(feedback.feedbackAt).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-gray-700 dark:text-gray-300 mt-2">{feedback.feedback}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {sub.submission.status !== "APPROVED"  ? (sub.rule.reward.applyWhen === "ON_SUBMISSION" ? (null): ( <Button
                                            onClick={() => openEditDialog(sub)
                                            }
                                        >
                                            Edit
                                        </Button>)): (null)}
                                    </CardContent>
                                )}

                                <Dialog open={editDialogOpen} onOpenChange={(open) => {
                                    setEditDialogOpen(open);
                                    if (!open) {
                                        setEditingSubmission(null);
                                        setExistingFiles([]);
                                        setExistingImages([]);
                                        setEditError(null);
                                    }
                                }}>
                                    <DialogContent className="sm:max-w-[600px]">
                                        <DialogHeader>
                                            <DialogTitle>Edit Submission</DialogTitle>
                                            <DialogDescription>{editingSubmission?.activity?.title}</DialogDescription>
                                        </DialogHeader>

                                        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto px-1 pr-4 -mr-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="editTextResponse" className="flex justify-between items-center">
                                                    <span>
                                                        Your Response{" "}
                                                        {isTextRequired ? (
                                                            <span className="text-red-500">*</span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">(optional)</span>
                                                        )}
                                                    </span>
                                                    <span className={`text-[10px] font-medium ${editTextResponse.length > 5000 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                                                        {editTextResponse.length}/5000 characters
                                                    </span>
                                                </Label>
                                                <textarea
                                                    id="editTextResponse"
                                                    className={`flex min-h-[120px] w-full rounded-md border ${editTextResponse.length > 5000 ? 'border-red-500 focus-visible:ring-red-500' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                                                    placeholder="Write your response here..."
                                                    value={editTextResponse}
                                                    onChange={(e) => setEditTextResponse(e.target.value)}
                                                    disabled={isUpdating}
                                                />
                                                {editTextResponse.length > 5000 && (
                                                    <p className="text-[11px] text-red-500 font-medium">Character limit exceeded. Response should be limited to 5000 characters.</p>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                <Label>
                                                    Files (PDF){" "}
                                                    {isPdfRequired ? (
                                                        <span className="text-red-500">*</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">(optional)</span>
                                                    )}
                                                </Label>
                                                <Input
                                                    type="file"
                                                    multiple
                                                    onChange={(e) => {
                                                        if (e.target.files) {
                                                            setEditFiles((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
                                                        }
                                                    }}
                                                    disabled={isUpdating}
                                                />
                                                <div className="flex flex-wrap gap-3 mt-2">
                                                    {/* Existing Files */}
                                                    {existingFiles.map((file, idx) => (
                                                        <div key={`existing-file-${idx}`} className="group relative flex flex-col items-center p-3 bg-muted/30 rounded-lg border w-32">
                                                            <div className="flex items-center justify-center w-12 h-12 bg-primary/5 rounded mb-2">
                                                                <FileText className="h-6 w-6 text-primary" />
                                                            </div>
                                                            <span className="text-[10px] text-center line-clamp-2 px-1 w-full" title={file.name}>{file.name}</span>
                                                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-1 bg-background border rounded hover:text-primary">
                                                                    <Eye className="h-3 w-3" />
                                                                </a>
                                                                <button type="button" onClick={() => setExistingFiles(existingFiles.filter((_, i) => i !== idx))} className="p-1 bg-background border rounded text-destructive hover:bg-destructive/10">
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* New Files */}
                                                    {editFiles.map((file, idx) => (
                                                        <div key={`new-file-${idx}`} className="group relative flex flex-col items-center p-3 bg-primary/5 rounded-lg border border-primary/20 w-32 border-dashed">
                                                            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded mb-2">
                                                                <FileText className="h-6 w-6 text-primary" />
                                                            </div>
                                                            <span className="text-[10px] text-center line-clamp-2 px-1 w-full">{file.name}</span>
                                                            <button type="button" onClick={() => setEditFiles(editFiles.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-background border rounded text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                            <span className="absolute top-1 left-1 px-1 bg-primary text-[8px] text-primary-foreground rounded">NEW</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <Label>
                                                    Images{" "}
                                                    {isImageRequired ? (
                                                        <span className="text-red-500">*</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">(optional)</span>
                                                    )}
                                                </Label>
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={(e) => {
                                                        if (e.target.files) {
                                                            setEditImages((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
                                                        }
                                                    }}
                                                    disabled={isUpdating}
                                                />
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-2">
                                                    {/* Existing Images */}
                                                    {existingImages.map((img, idx) => (
                                                        <div key={`existing-img-${idx}`} className="group relative aspect-square rounded-lg border overflow-hidden bg-muted/50">
                                                            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                <a href={img.url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-background rounded-full hover:text-primary">
                                                                    <Eye className="h-4 w-4" />
                                                                </a>
                                                                <button type="button" onClick={() => setExistingImages(existingImages.filter((_, i) => i !== idx))} className="p-1.5 bg-background rounded-full text-destructive hover:bg-red-50">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* New Images */}
                                                    {editImages.map((img, idx) => (
                                                        <div key={`new-img-${idx}`} className="group relative aspect-square rounded-lg border border-primary/30 overflow-hidden bg-primary/5 border-dashed">
                                                            <img src={URL.createObjectURL(img)} alt={img.name} className="w-full h-full object-cover" />
                                                            <button type="button" onClick={() => setEditImages(editImages.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-background/80 backdrop-blur-sm rounded-full text-destructive hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                            <span className="absolute top-1 left-1 px-1 bg-primary text-[8px] text-primary-foreground rounded">NEW</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label>
                                                        Links{" "}
                                                        {isUrlRequired ? (
                                                            <span className="text-red-500">*</span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">(optional)</span>
                                                        )}
                                                    </Label>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={addEditLink}
                                                        disabled={isUpdating}
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Add Link
                                                    </Button>
                                                </div>
                                                {editLinks.map((link, index) => (
                                                    <div key={index} className="flex gap-2 items-start">
                                                        <div className="flex-1 space-y-2">
                                                            <Input
                                                                placeholder="URL (e.g. https://github.com/...)"
                                                                value={link.url}
                                                                onChange={(e) => updateEditLink(index, "url", e.target.value)}
                                                                disabled={isUpdating}
                                                            />
                                                            <Input
                                                                placeholder="Label (e.g. GitHub Repository)"
                                                                value={link.label}
                                                                onChange={(e) => updateEditLink(index, "label", e.target.value)}
                                                                disabled={isUpdating}
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeEditLink(index)}
                                                            disabled={isUpdating}
                                                            className="mt-1 text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                {editLinks.length === 0 && (
                                                    <p className="text-sm text-muted-foreground">No links added yet.</p>
                                                )}
                                            </div>

                                            {editError && (
                                                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                                                    {editError}
                                                </div>
                                            )}
                                        </div>

                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isUpdating}>
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleUpdateSubmission}
                                                disabled={isUpdating || !isValidSubmission || editTextResponse.length > 5000}
                                            >
                                                {isUpdating ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Updating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="h-4 w-4 mr-2" />
                                                        Update Submission
                                                    </>
                                                )}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </Card>
                            )})}
                        </div>
                        
                        {/* Pagination Component */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalDocuments={filteredSubmissions.length}
                        onPageChange={setCurrentPage}
                    />
                </>
                )}
            </div>
        </TooltipProvider>
    );
}
