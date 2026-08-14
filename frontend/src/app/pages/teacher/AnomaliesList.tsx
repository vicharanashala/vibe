"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowUp, ArrowDown, Loader2, AlertCircle, Search, Layers, RefreshCw } from "lucide-react"
import { useAnomaliesByCourseItem, useCourseVersionById, type Anomaly } from "@/hooks/hooks"
import { useAnomalyStore } from "@/store/anomaly-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Pagination } from "@/components/ui/Pagination"
import { Input } from "@/components/ui/input"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import CourseBackButton from "./CourseBackButton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button"

export default function AnomaliesList() {
 
  const courseId = useAnomalyStore.getState().courseId
  const versionId = useAnomalyStore.getState().versionId

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<'createdAt' | 'type' | 'studentName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [anomalyType, setAnomalyType] = useState<string>('ALL');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { data: version, isLoading: versionLoading, error: versionError } = useCourseVersionById(versionId || "")
  const [cohort, setCohort] = useState<string | null>(null);

  // Anomaly types for filter dropdown
  const anomalyTypes = [
    { value: 'ALL', label: 'All Types' },
    { value: 'MULTIPLE_FACES', label: 'Multiple Faces' },
    { value: 'NO_FACE', label: 'No Face Detected' },
    { value: 'VOICE_DETECTION', label: 'Voice Detection' },
    { value: 'FOCUS', label: 'Focus Issues' },
    { value: 'FACE_RECOGNITION', label: 'Face Recognition' },
    { value: 'HAND_GESTURE_DETECTION', label: 'Hand Gesture' },
    { value: 'BLUR_DETECTION', label: 'Blur Detection' },
  ];

  // Debounce search input
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1); // Reset to first page on new search
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

// updated code for filter and search feature in anomlaies

  // Handle filter change
  const handleTypeChange = (value: string) => {
    setAnomalyType(value);
    setPage(1); // Reset to first page on filter change
  };

  const {
    data: anomalies = [],
    isLoading,
    error,
    refetch,
    total,
    totalPages,
    isRefetching,
  } = useAnomaliesByCourseItem(
    courseId as string,
    versionId as string,
    page,
    limit,
    sortBy,
    sortOrder,
    debouncedSearch,
    anomalyType === 'ALL' ? undefined : anomalyType,
    cohort ?? undefined
  );

  // A separate, unfiltered, larger fetch purely to build the "who has the
  // most violations" summary below — independent of the paginated/filtered
  // table above so filtering the table doesn't skew the leaderboard.
  const { data: allAnomaliesForSummary = [] } = useAnomaliesByCourseItem(
    courseId as string,
    versionId as string,
    1,
    500,
    'createdAt',
    'desc',
    '',
    undefined,
    undefined,
  );

  const studentSummaries = useMemo(() => {
    const byStudent = new Map<string, {
      studentName: string; studentEmail: string; count: number; lastSeen: string;
    }>();
    for (const a of allAnomaliesForSummary) {
      const key = a.studentEmail || a.studentName || 'unknown';
      const existing = byStudent.get(key);
      if (existing) {
        existing.count += 1;
        if (new Date(a.createdAt) > new Date(existing.lastSeen)) existing.lastSeen = String(a.createdAt);
      } else {
        byStudent.set(key, {
          studentName: a.studentName || 'Unknown User',
          studentEmail: a.studentEmail || '',
          count: 1,
          lastSeen: String(a.createdAt),
        });
      }
    }
    return Array.from(byStudent.values()).sort((a, b) => b.count - a.count);
  }, [allAnomaliesForSummary]);

  const maxCount = studentSummaries[0]?.count ?? 0;

  // Drill down into a specific student: reuses the existing server-side
  // search filter, so it's the same query path as typing in the search box.
  const focusStudent = (email: string) => {
    setSearchQuery(email);
    setDebouncedSearch(email);
    setPage(1);
  };

  const typeLabels: Record<string, string> = {
    MULTIPLE_FACES: 'Multiple Faces',
    NO_FACE: 'Face Not Detected',
    VOICE_DETECTION: 'Noise Detected',
    FOCUS: 'Focus Issue',
    FACE_RECOGNITION: 'Face Mismatch',
    HAND_GESTURE_DETECTION: 'Hand Gesture',
    BLUR_DETECTION: 'Blur Detected',
    LIVENESS: 'Liveness Detection',
    LOOKING_AWAY: 'Looking Away',
  };

  // Explainable-metadata violations (PR "Liveness & Video Integrity Detection")
  // are treated as the most severe row-level signal — everything else is a
  // lighter-weight heuristic flag.
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'LIVENESS':
      case 'LOOKING_AWAY':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MULTIPLE_FACES':
      case 'NO_FACE':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'VOICE_DETECTION':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'FACE_RECOGNITION':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  const getTypeBadge = (anomaly: Anomaly) => {
    const badge = (
      <Badge variant="outline" className={getTypeBadgeClass(anomaly.type)}>
        {typeLabels[anomaly.type] || anomaly.type}
      </Badge>
    );

    // Only LIVENESS/LOOKING_AWAY violations (PR1's "Explainable Violation
    // Metadata") carry a metadata payload — surface it on hover so instructors
    // can see *why* the detector fired, not just that it did.
    if (!anomaly.metadata) return badge;

    const { reason, durationMs, consecutiveFrames, signalStrength, detectedAt } = anomaly.metadata;
    return (
      <HoverCard openDelay={100}>
        <HoverCardTrigger asChild>
          <button type="button" className="cursor-pointer">{badge}</button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72 text-sm">
          <div className="space-y-2">
            <div className="font-semibold">Liveness Violation Details</div>
            {reason && (
              <div>
                <div className="text-xs text-muted-foreground">Reason</div>
                <div>{reason}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {durationMs !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div>{durationMs.toLocaleString()} ms</div>
                </div>
              )}
              {consecutiveFrames !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground">Consecutive Frames</div>
                  <div>{consecutiveFrames}</div>
                </div>
              )}
              {signalStrength !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div>{Math.round(signalStrength * 100)}%</div>
                </div>
              )}
              {detectedAt && (
                <div>
                  <div className="text-xs text-muted-foreground">Detected At</div>
                  <div>{new Date(detectedAt).toLocaleTimeString()}</div>
                </div>
              )}
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  const handleSort = (column: 'createdAt' | 'type' | 'studentName') => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setPage(1); 
  };

  // if (isLoading) {
  //   return (
  //     <div className="flex items-center justify-center h-64">
  //       <Loader2 className="h-8 w-8 animate-spin" />
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 space-y-8">
        <CourseBackButton />
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Course Anomalies
              </h1>
            </div>
          </div>
        </div>

        {/* Top violators — per-student violation counts, tap to drill in */}
        {studentSummaries.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Students by Violation Count</h2>
                <p className="text-sm text-muted-foreground">
                  Tap a student to see all of their flagged activity below.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {studentSummaries.map((s, index) => (
                  <button
                    key={s.studentEmail || s.studentName}
                    type="button"
                    onClick={() => focusStudent(s.studentEmail)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                      debouncedSearch && debouncedSearch === s.studentEmail ? 'border-primary bg-muted/40' : 'border-border'
                    }`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${s.studentName}`} />
                      <AvatarFallback>{s.studentName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{s.studentName}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.studentEmail}</div>
                      {index === 0 && (
                        <Badge variant="destructive" className="mt-1 text-[10px] px-1.5 py-0">Most violations</Badge>
                      )}
                      <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${maxCount ? Math.round((s.count / maxCount) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-bold leading-none">{s.count}</div>
                      <div className="text-[10px] text-muted-foreground">{s.count === 1 ? 'violation' : 'violations'}</div>
                    </div>
                  </button>
                ))}
              </div>
              {debouncedSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearchQuery(''); setDebouncedSearch(''); setPage(1); }}
                >
                  Clear student filter
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Search Input */}
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search students..."
            className="w-full pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setDebouncedSearch(searchQuery.trim());
                setPage(1);
              }
            }}
          />
        </div>

        {/* Anomalies Table */}
        <Card className="border-0 shadow-lg overflow-hidden px-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Card className="w-full">
                <CardContent className="p-6">
                  <div className="flex md:flex-row flex-col justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-semibold">Anomalies</h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isRefetching || isLoading}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                        {isRefetching ? "Refreshing..." : "Refresh"}
                      </Button>
                    </div>
                    <div className="flex md:flex-row flex-col gap-4 w-full sm:w-auto md:mt-0 mt-3">

                    {(version as any)?.cohortDetails?.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                            <Layers className="h-4 w-4 text-muted-foreground" />
                    {cohort ? (version as any).cohortDetails.find((c: any) => c.id === cohort)?.name : "Select Cohort"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuRadioGroup
                              value={cohort ?? ""}
                              onValueChange={(id) => {
                                setCohort(id);
                              }}
                            >
                        <DropdownMenuRadioItem
                          value={""}
                          onClick={() => setCohort(null)}>
                          All Cohorts
                        </DropdownMenuRadioItem>
                              {(version as any)?.cohortDetails?.map((cohort: any) => (
                                <DropdownMenuRadioItem
                                  key={cohort.id}
                                  value={cohort.id}
                                >
                                  {cohort.name}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {/* Type Filter */}
                      <select
                        value={anomalyType}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {anomalyTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">Show</span>
                        <select
                          value={limit}
                          onChange={handleLimitChange}
                          className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <span className="text-sm text-muted-foreground">per page</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => handleSort('createdAt')}
                          >
                            <div className="flex items-center">
                              Detected At
                              {sortBy === 'createdAt' && (
                                sortOrder === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
                              )}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(isLoading || isSearching) ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-12">
                              <div className="flex items-center justify-center space-x-2">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <span className="text-muted-foreground">
                                  {isSearching ? 'Searching...' : 'Loading anomalies...'}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : error ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-12">
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <AlertCircle className="h-8 w-8 text-destructive" />
                                <p className="text-destructive text-sm">{error}</p>
                                <button
                                  onClick={() => refetch()}
                                  className="text-sm text-primary hover:underline mt-2 flex items-center space-x-1"
                                  disabled={isLoading}
                                >
                                  <span>Try again</span>
                                  {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : anomalies.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                              No anomalies found
                            </TableCell>
                          </TableRow>
                        ) : (
                          anomalies.map((anomaly) => (
                            <TableRow key={anomaly.id || anomaly._id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${anomaly.studentName}`} />
                                    <AvatarFallback>{anomaly.studentName?.charAt(0) || 'U'}</AvatarFallback>
                                  </Avatar>
                                  <div className="space-y-1 flex flex-col items-start p-1">
                                    <div className="font-medium">{anomaly.studentName || 'Unknown User'}</div>
                                    <div className="text-xs text-muted-foreground">{anomaly.studentEmail}</div>
                                    {anomaly.cohortName && (
                                      <div className="text-xs text-muted-foreground">Cohort: {anomaly.cohortName}</div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {getTypeBadge(anomaly)}
                                  {anomaly.metadata?.reason && (
                                    <div className="text-xs text-muted-foreground max-w-xs">
                                      {anomaly.metadata.reason}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {new Date(anomaly.createdAt).toLocaleDateString('en-GB') + ' ' + 
                                 new Date(anomaly.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {(anomalies.length > 0 || !isLoading) && (
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      totalDocuments={total}
                      onPageChange={handlePageChange}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
