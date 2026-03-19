import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHpStudentCohorts, useMyHpLedger, useHpActivities } from "@/hooks/hooks";
import { getEffectiveIds } from "@/lib/api/hp-system";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/Pagination";
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
    Calendar,
    AlertCircle,
    CheckCircle2,
    Search,
} from "lucide-react";
import { DirectionBadge } from "@/app/pages/teacher/hp-system/components/DirectionBadge";

export default function StudentLedgerPage() {
    const navigate = useNavigate();
    const [selectedEntry, setSelectedEntry] = useState<any>(null);

    // Pagination and search state
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // 1. Get student's cohorts so we can call getMyLedger with valid IDs
    const { data: cohorts = [], isLoading: isLoadingCohorts } = useHpStudentCohorts();

    // Pick the first cohort for the API call (backend returns ALL transactions regardless)
    const firstCohort = cohorts[0];
    const { courseId: effectiveCourseId, courseVersionId: effectiveVersionId } = getEffectiveIds(
        firstCohort?.cohortName || "",
        firstCohort?.courseId || "",
        firstCohort?.courseVersionId || ""
    );

    // 2. Fetch Ledger Data
    const { data: ledger = [], studentDetails, isLoading: isLoadingLedger, error } = useMyHpLedger(
        effectiveCourseId,
        effectiveVersionId,
        firstCohort?.cohortName || ""
    );

    // 3. Build a combined activity map from all cohorts for resolving activity names
    const cohortQueries = cohorts.map((c: any) => {
        const { courseVersionId: evId } = getEffectiveIds(c.cohortName, c.courseId, c.courseVersionId);
        return { versionId: evId, cohortName: c.cohortName };
    });

    // Fetch activities from all cohorts to build complete activity map
    const activityQueries = cohortQueries.map((query) => {
        return useHpActivities(query.versionId, query.cohortName);
    });

    // Combine all activities from all cohorts
    const allActivities = activityQueries.reduce((acc: any[], queryResult) => {
        if (queryResult.data) {
            acc.push(...queryResult.data);
        }
        return acc;
    }, []);

    const activityMap = useMemo(() => {
        const map: Record<string, string> = {};
        allActivities.forEach((act: any) => {
            map[act._id] = act.title;
        });
        return map;
    }, [allActivities]);

    const totalLoading = isLoadingCohorts || isLoadingLedger || activityQueries.some(q => q.isLoading);

    // Pagination logic
    const filteredLedger = useMemo(() => {
        if (!ledger) return [];
        return ledger.filter((entry: any) => {
            const activityName = entry.activityTitle || 'Manual Adjustment';
            return activityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   entry.cohort?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   entry.eventType?.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [ledger, searchQuery]);

    const paginatedLedger = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredLedger.slice(startIndex, endIndex);
    }, [filteredLedger, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredLedger.length / itemsPerPage);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1); // Reset to first page when searching
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page when changing items per page
    };


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
        <div className="container mx-auto p-6 max-w-6xl space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center gap-4 border-b pb-4">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate({ to: '/student/hp-system/cohorts' as any })}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold tracking-tight">HP History</h2>
                    <p className="text-muted-foreground">
                        Your House Points transaction history across all cohorts
                    </p>
                </div>
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

            {/* Ledger Table */}
            {totalLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : ledger.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    No HP transactions found yet.
                </div>
            ) : (
                <>
                    {/* Search and Pagination Controls */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-6">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search transactions..."
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

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Transaction History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Activity Name</TableHead>
                                        <TableHead>Cohort</TableHead>
                                        <TableHead>Event Type</TableHead>
                                        <TableHead>Direction</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Deadline</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedLedger.map((entry: any) => (
                                    <TableRow key={entry._id}>
                                        <TableCell>
                                            <div className="font-medium max-w-[200px] truncate">
                                                {activityMap[entry.activityTitle] || entry.activityTitle || 'Manual Adjustment'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal text-xs">
                                                {entry.cohort || '—'}
                                            </Badge>
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
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedEntry(entry)}
                                            >
                                                View more
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                {/* Pagination Component */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalDocuments={filteredLedger.length}
                    onPageChange={setCurrentPage}
                />
                </>
            )}

            {/* Detail View Modal */}
            <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <HistoryIcon className="h-5 w-5" />
                            Transaction Details
                        </DialogTitle>
                    </DialogHeader>
                    {selectedEntry && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity</p>
                                    <p className="text-sm font-semibold">{selectedEntry.activityTitle || 'Manual Adjustment'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cohort</p>
                                    <Badge variant="outline">{selectedEntry.cohort || '—'}</Badge>
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
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Note</p>
                                    <div className="flex items-start gap-2 text-sm bg-muted/30 p-3 rounded-md min-h-[60px]">
                                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <p className="italic text-muted-foreground">
                                            {selectedEntry.meta?.note || 'No additional notes provided.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper component for transaction icon
function HistoryIcon(props: any) {
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
    );
}
