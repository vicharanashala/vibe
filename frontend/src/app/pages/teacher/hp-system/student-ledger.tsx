import { useState, useMemo } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentLedger, useHpCourseVersions, useHpActivities } from "@/hooks/hooks";
import { getEffectiveIds } from "@/lib/api/hp-system";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    ArrowLeft,
    Zap,
    User,
    Mail,
    Clock,
    MessageSquare,
    Eye,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Search,
    RefreshCw
} from "lucide-react";

export default function StudentLedgerPage() {
    const { courseVersionId, cohortName, studentId } = useParams({ strict: false });
    const navigate = useNavigate();
    const [selectedEntry, setSelectedEntry] = useState<any>(null);
    
    // Pagination and search state
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // 1. Resolve raw courseId from courseVersionId 
    const { data: versions = [], isLoading: isLoadingCourses } = useHpCourseVersions();
    const course = versions.find((c: any) =>
        c.versions.some((v: any) => v.courseVersionId === courseVersionId)
    );
    const rawCourseId = course?.courseId || "000000000000000000000001";

    // 2. Resolve Effective IDs (Real DB IDs) for the API call
    const { courseId: effectiveCourseId, courseVersionId: effectiveVersionId } = getEffectiveIds(
        cohortName || "",
        rawCourseId,
        courseVersionId || ""
    );

    // 3. Fetch Ledger Data
    const { data: ledger = [], studentDetails, isLoading: isLoadingLedger, error, refetch, isRefetching } = useHpStudentLedger(
        studentId || "",
        cohortName || "",
        effectiveCourseId,
        effectiveVersionId
    );

    // console.log("Fetched ledger entries:", ledger, "Loading:", isLoadingLedger, "Error:", error);

    // 4. Fetch Activities to map IDs to Titles
    const { data: activities = [], isLoading: isLoadingActivities } = useHpActivities(
        effectiveVersionId,
        cohortName || ""
    );

    const activityMap = useMemo(() => {
        const map: Record<string, string> = {};
        activities.forEach((act: any) => {
            map[act._id] = act.title;
        });
        return map;
    }, [activities]);
    
    // Filter ledger entries based on search query with prioritized results
    const filteredLedger = useMemo(() => {
        if (!searchQuery.trim()) return ledger;
        
        const query = searchQuery.toLowerCase();
        
        // Separate entries into priority groups
        const startsWithMatches: any[] = [];
        const containsMatches: any[] = [];
        const otherMatches: any[] = [];
        
        ledger.forEach((entry: any) => {
            const activityTitle = activityMap[entry.activityId] || entry.activityTitle || 'Manual Adjustment';
            const eventType = entry.eventType || '';
            const direction = entry.direction || '';
            
            const titleStartsWith = activityTitle.toLowerCase().startsWith(query);
            const titleContains = activityTitle.toLowerCase().includes(query);
            const eventContains = eventType.toLowerCase().includes(query);
            const directionContains = direction.toLowerCase().includes(query);
            
            if (titleStartsWith) {
                startsWithMatches.push(entry);
            } else if (titleContains || eventContains || directionContains) {
                containsMatches.push(entry);
            } else {
                otherMatches.push(entry);
            }
        });
        
        // Return prioritized results: starts with > contains > others
        return [...startsWithMatches, ...containsMatches, ...otherMatches];
    }, [ledger, activityMap, searchQuery]);
    
    // Pagination logic
    const totalPages = Math.ceil(filteredLedger.length / itemsPerPage);
    const paginatedLedger = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredLedger.slice(startIndex, endIndex);
    }, [filteredLedger, currentPage, itemsPerPage]);
    
    // Reset page when search or items per page changes
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };
    
    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1);
    };

    const totalLoading = isLoadingLedger || isLoadingCourses || isLoadingActivities;

    

    const formatDateTime = (iso?: string) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const formatDate = (iso?: string) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    if (error) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 font-semibold">Error loading ledger: {error}</p>
                <Button variant="link" onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full pb-12">
            {/* Header */}
            <div className="flex items-center gap-4 border-b pb-4">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate({
                        to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/activities`
                    })}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold tracking-tight">HP History</h2>
                    <p className="text-muted-foreground">
                        Transaction ledger for {decodeURIComponent(cohortName || '')}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isRefetching || totalLoading}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                    {isRefetching ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            {/* Student Info Card */}
            <Card className="bg-gradient-to-r from-card to-muted/30">
                <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-semibold text-lg">
                            {studentDetails
                                ? studentDetails.studentName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                                : '??'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {studentDetails?.studentName || 'Loading...'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                {studentDetails?.studentEmail || '—'}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 text-3xl font-bold">
                            <Zap className="h-7 w-7 text-yellow-500" />
                            {studentDetails?.hpPoints ?? 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Current Total HP</div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Search and Pagination Controls */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by activity name, event type..."
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

            {/* Ledger Table */}
            {totalLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : ledger.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    No HP transactions found for this student.
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Transaction History</CardTitle>
                            <span className="text-sm text-muted-foreground">
                                Showing {paginatedLedger.length} of {filteredLedger.length} transactions
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Activity Name</TableHead>
                                    <TableHead>Event Type</TableHead>
                                    <TableHead>Direction</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Deadline</TableHead>
                                    <TableHead>Date of Submission</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLedger.map((entry: any) => (
                                    <TableRow key={entry._id}>
                                        <TableCell>
                                            <div className="font-medium max-w-[200px] truncate">
                                                {activityMap[entry.activityId] || entry.activityTitle || 'Manual Adjustment'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal uppercase text-[10px]">
                                                {entry.eventType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell><DirectionBadge direction={entry.direction} /></TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-semibold ${entry.direction === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {entry.direction === 'CREDIT' ? '+' : '-'}{entry.amount}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">
                                                {formatDate(entry.calc?.deadlineAt)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <Calendar className="h-3.5 w-3.5" />
                                                <span>{formatDate(entry.createdAt)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button

                                                onClick={() => setSelectedEntry(entry)}
                                            >
                                                view more
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
                <Card>
                    <CardContent className="p-4">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalDocuments={filteredLedger.length}
                            onPageChange={setCurrentPage}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Detail View Modal */}
            <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Transaction Details
                        </DialogTitle>
                    </DialogHeader>
                    {selectedEntry && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-[2fr_1fr] gap-x-6 gap-y-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity</p>
                                    <p className="text-sm font-semibold">{activityMap[selectedEntry.activityId] || selectedEntry.activityTitle || 'Manual Adjustment'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Event Type</p>
                                    <Badge variant="secondary">{selectedEntry.eventType}</Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</p>
                                    <div className="flex items-center gap-2">
                                        <DirectionBadge direction={selectedEntry.direction} />
                                        <span className={`text-lg font-bold ${selectedEntry.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                            {selectedEntry.direction === 'CREDIT' ? '+' : '-'}{selectedEntry.amount}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</p>
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                        {formatDateTime(selectedEntry.createdAt)}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deadline</p>
                                    <p className="text-sm">{formatDateTime(selectedEntry.calc?.deadlineAt)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason Code</p>
                                    <Badge variant="outline">{selectedEntry.calc?.reasonCode || '—'}</Badge>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Triggered By</p>
                                    <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-md">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{selectedEntry.meta?.triggeredBy || 'SYSTEM'}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({selectedEntry.meta?.triggeredBy === 'SYSTEM' 
                                                ? 'Automated' 
                                                : selectedEntry.meta?.triggeredByUserName || selectedEntry.meta?.triggeredByUserId || 'Automated'
                                            })
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5"><MessageSquare className="h-4 w-4 text-muted-foreground inline" /> Note</p>
                                    <div className="flex flex-col items-start gap-2 text-sm bg-muted/30 p-3 rounded-md min-h-[60px]">

                                        <p className="italic text-muted-foreground">
                                            {selectedEntry.meta?.note || 'No additional notes provided.'}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            HP Calculation
                                        </p>

                                        <div className="bg-muted/40 rounded-md p-3 space-y-2 text-sm">

                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Base HP</span>
                                                <span className="font-medium">
                                                    {selectedEntry.calc?.baseHpAtTime}
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">
                                                    {selectedEntry.direction === "CREDIT" ? "Reward Added" : "Penalty Applied"}
                                                </span>

                                                <span className={`font-medium ${selectedEntry.direction === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                                                    {selectedEntry.direction === "CREDIT" ? "+" : "-"}
                                                    {selectedEntry.amount}

                                                    {selectedEntry.calc?.percentage && (
                                                        <span className="text-xs text-muted-foreground ml-1">
                                                            ({selectedEntry.calc.percentage}% rule)
                                                        </span>
                                                    )}
                                                </span>
                                            </div>

                                            <div className="border-t pt-2 flex justify-between font-semibold">
                                                <span>Final HP</span>
                                                <span>{selectedEntry.calc?.computedAmount}</span>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {selectedEntry?.eventType!== "BASE_INIT" && selectedEntry?.eventType!=="RESET" &&
                        <Button className="w-full" onClick={() => navigate({ 
                                to: selectedEntry?.submissionId 
                                    ? `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/student/${studentId}/submission/${selectedEntry.submissionId}`
                                    : `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/student/${studentId}/submissions`
                            })}>View Submission
                        </Button>
                    }
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper component for transaction icon
function History(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="m12 7 0 5 3 2" />
        </svg>
    )
}
