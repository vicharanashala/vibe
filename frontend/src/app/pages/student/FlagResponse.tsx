import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, AlertCircle, BookOpen, Tag, ListChecks, Calendar, Eye, Hash, ThumbsDown, ThumbsUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourseStore } from "@/store/course-store";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/button";
import { useGetCourseIssueReports, useUpdateStudentInterest } from "@/hooks/hooks";
import { toast } from "sonner";
// import { Textarea } from "@/components/ui/textarea";

// export interface IssueReport {
//   _id: string;
//   detail: Record<string, any>;
//   status: IssueStatus;
//   createdAt: string;
// }

// export type IssueStatus = "ALL" | "REPORTED" | "IN_REVIEW" | "RESOLVED" | "DISCARDED" | "CLOSED"
// export type IssueSort = "ALL" | "VIDEO" | "QUIZ" | "ARTICLE" | "QUESTION";
export type IssueStatus =
  | "ALL"
  | "REPORTED"
  | "IN_REVIEW"
  | "RESOLVED"
  | "DISCARDED"
  | "CLOSED";

export type EntityType = "ALL" | "VIDEO" | "QUIZ" | "ARTICLE" | "QUESTION";

export interface IssueStatusHistory {
  status: IssueStatus;
  comment: string;
  createdAt: string;
  createdBy?: string;
}

export interface IssueReport {
  _id: string;
  courseId: string;
  versionId: string;
  entityId: string;
  entityType: EntityType;
  reason: string;
  reportedBy: string;
  status: IssueStatusHistory[]; // <-- correct
  createdAt: string;
  updatedAt: string;
}

export interface IssueReportsResponse {
  issues: IssueReport[];
  totalDocuments: number;
  totalPages: number;
}
export default function CourseIssueReports() {
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<IssueStatus>('ALL');
  const [issueSort, setIssueSort] = useState<EntityType>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const { currentCourse } = useCourseStore()
  const versionId = currentCourse?.versionId

  const PAGE_LIMIT = 15;

  const params = useMemo(() => ({
    status: filterStatus,
    search: searchTerm,
    sort: issueSort,
    page: currentPage,
    limit: PAGE_LIMIT,
  }), [filterStatus, searchTerm, issueSort, currentPage]);
  const { data: issuesData, isLoading, refetch: issuesRefetch } = useGetCourseIssueReports(versionId as string, params);
  const issues = issuesData?.issues || []
  console.log(issues)
  useEffect(() => {
    issuesRefetch();
  }, [params, issuesRefetch]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              My Issues
            </h1>
            <p className="text-muted-foreground">
              Review and manage all the issues you raised.
            </p>
          </div>
        </div>

        <IssueFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          issueSort={issueSort}
          setIssueSort={setIssueSort}
          setCurrentPage={setCurrentPage}
        />

        {/* Table */}
        <Card className="border-0 shadow-lg overflow-hidden min-h-[50vh]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    <TableHead className="w-[50px]">
                      <span className="inline-flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        S.No.
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        Reason
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        Course
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        Type
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground w-[150px]">
                      <span className="inline-flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-muted-foreground" />
                        Status
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground w-[200px]">
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Reported On
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground pr-6 w-[150px]">
                      <span className="inline-flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        Details
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-muted-foreground">
                            Loading issues...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : issues?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <AlertTriangle className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <p className="text-foreground text-xl font-semibold mb-2">
                          No Issues Reported
                        </p>
                        <p className="text-muted-foreground">
                          There are no course issue reports yet.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    issues?.map((issue: IssueReport, index: number) => {
                      const detail = issue || {};
                      console.log("Issue ", issue)
                      console.log("detail", detail)
                      const latestStatus = Array.isArray(issue.status) && issue.status.length > 0
                        ? issue.status[issue.status.length - 1].status
                        : issue.status;
                      console.log("latest status ", latestStatus)
                      return (
                        <TableRow
                          key={issue._id}
                          className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                        >
                          <TableCell className="py-4">
                            {index + 1 + (currentPage - 1) * PAGE_LIMIT}
                          </TableCell>

                          <TableCell className="py-4 font-medium">
                            {detail.reason || '-'}
                          </TableCell>

                          <TableCell className="py-4">
                            {detail.courseId || '-'}
                          </TableCell>

                          <TableCell className="py-4">
                            {detail.entityType || '-'}
                          </TableCell>

                          <TableCell className="py-4">
                            <Badge
                              variant={
                                latestStatus === "RESOLVED" || latestStatus === "CLOSED"
                                  ? "default"
                                  : latestStatus === "DISCARDED"
                                    ? "destructive"
                                    : latestStatus === "IN_REVIEW"
                                      ? "secondary"
                                      : "outline"
                              }
                            >
                              {issue.status[0].status.charAt(0).toUpperCase() + issue.status[0].status.slice(1).toLowerCase()}
                              {/* {latestStatus
                                ? .charAt(0).toUpperCase() + latestStatus.slice(1).toLowerCase()
                                : "-"} */}
                            </Badge>
                          </TableCell>

                          <TableCell className="py-4">
                            {issue.createdAt ? (
                              <div className="flex flex-col">
                                <span>
                                  {new Date(issue.createdAt).toLocaleDateString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                  })}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(issue.createdAt).toLocaleTimeString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>

                          <TableCell className="py-4 pr-6">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedIssue(issue)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {issuesData?.totalDocuments > PAGE_LIMIT && (
          <Pagination
            currentPage={currentPage}
            totalPages={issuesData?.totalPages}
            totalDocuments={issuesData?.totalDocuments}
            onPageChange={handlePageChange}
          />
        )}

        {selectedIssue && (
          <IssueDetailsDialog
            issue={selectedIssue}
            onClose={() => setSelectedIssue(null)}
            refetchIssues={issuesRefetch}
          />
        )}
      </div>
    </div>
  );
}

interface IssueDetailsDialogProps {
  issue: IssueReport | null;
  onClose: () => void;
}


interface IssueDetailsDialogProps {
  issue: IssueReport | null;
  onClose: () => void;
  refetchIssues: () => void;
}

export function IssueDetailsDialog({
  issue,
  onClose,
  refetchIssues
}: IssueDetailsDialogProps) {

  const [isSubmitting, setIsSubmitting] = useState(false)
  const { mutateAsync } = useUpdateStudentInterest()
  if (!issue) return null;
  const latestStatus =
    Array.isArray(issue.status) && issue.status.length > 0
      ? issue.status[issue.status.length - 1]
      : null;
  const handleFeedback = async (interest: "yes" | "no") => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const result = await mutateAsync({ issueId: issue._id, interest });
      await refetchIssues();
      toast.success(result.message)
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <Dialog open={!!issue} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto py-8 bg-background">
        <DialogHeader className="pb-6 border-b border-border">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
            <AlertCircle className="h-7 w-7 text-destructive/80" />
            Issue Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 mt-6">
          {/* Status Section */}
          {latestStatus && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Current Status
              </h3>
              <Card className="shadow-md border-l-4 border-primary/20 rounded-xl overflow-hidden">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <label className="font-semibold text-foreground">Current Status </label>
                        <Badge
                          variant={
                            latestStatus.status === "RESOLVED" ||
                              latestStatus.status === "CLOSED"
                              ? "default"
                              : latestStatus.status === "DISCARDED"
                                ? "destructive"
                                : latestStatus.status === "IN_REVIEW"
                                  ? "secondary"
                                  : "outline"
                          }
                          className="px-4 py-2 text-sm font-semibold"
                        >
                          {latestStatus.status}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-foreground/80">
                          <span className="font-semibold text-foreground">Entity Type:</span>{" "}
                          <span className="text-muted-foreground">{issue.entityType}</span>
                        </p>
                        <p className="text-sm text-foreground/80">
                          <span className="font-semibold text-foreground">Reason:</span>{" "}
                          <span className="text-muted-foreground">{issue.reason}</span>
                        </p>
                      </div>
                      {latestStatus.comment && (
                        <Separator className="my-3 bg-border" />
                      )}
                      {latestStatus.comment && (
                        <div className="bg-muted/50 p-3 rounded-md border border-border/20">
                          <p className="text-sm text-foreground/90 italic">
                            <span className="font-semibold not-italic">Comment:</span>{" "}
                            {latestStatus.comment}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/80 whitespace-nowrap lg:text-right">
                      <p className="font-medium text-foreground/90">Last Updated</p>
                      <p className="text-xs font-mono">
                        {new Date(latestStatus.createdAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>

                    </div>
                  </div>

                  {latestStatus && latestStatus.status !== "REPORTED" && (
                    <div className="mt-6 pt-4 border-t border-border/50">
                      <h4 className="text-sm font-semibold text-foreground mb-3">
                        Are you satisfied with the response?
                      </h4>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeedback("yes")}
                          disabled={isSubmitting}
                          className="flex items-center gap-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <ThumbsUp className="h-4 w-4 text-primary" />
                          Yes
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeedback("no")}
                          disabled={isSubmitting}
                          className="flex items-center gap-2 border-destructive/20 hover:border-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <ThumbsDown className="h-4 w-4 text-destructive" />
                          No
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



interface IssueFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  filterStatus: IssueStatus;
  setFilterStatus: (val: IssueStatus) => void;
  issueSort: EntityType;
  setIssueSort: (val: EntityType) => void;
  setCurrentPage: (page: number) => void;
}

export function IssueFilters({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  issueSort,
  setIssueSort,
  setCurrentPage,
}: IssueFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <Eye size={20} />
        </span>

        <Input
          placeholder="Search by reason or course…"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-10"
        />
      </div>

      <Select
        value={filterStatus}
        onValueChange={(value: IssueStatus) => {
          setFilterStatus(value);
          setCurrentPage(1);
        }}
      >
        <SelectTrigger className="w-[180px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-gray-500" />
            <SelectValue placeholder="Filter by status" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All</SelectItem>
          <SelectItem value="REPORTED">Reported</SelectItem>
          <SelectItem value="IN_REVIEW">In Review</SelectItem>
          <SelectItem value="RESOLVED">Resolved</SelectItem>
          <SelectItem value="DISCARDED">Discarded</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={issueSort}
        onValueChange={(value: EntityType) => {
          setIssueSort(value);
          setCurrentPage(1);
        }}
      >
        <SelectTrigger className="w-[180px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <SelectValue placeholder="Filter by type" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Types</SelectItem>
          <SelectItem value="VIDEO">Video</SelectItem>
          <SelectItem value="QUIZ">Quiz</SelectItem>
          <SelectItem value="ARTICLE">Article</SelectItem>
          <SelectItem value="QUESTION">Question</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}