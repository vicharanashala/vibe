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
import { Loader2, AlertTriangle, AlertCircle, BookOpen, Tag, ListChecks, Calendar, Eye, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourseStore } from "@/store/course-store";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/button";
import { useGetCourseIssueReports } from "@/hooks/hooks";

export interface IssueReport {
  _id: string;
  detail: Record<string, any>;
  status: IssueStatus;
  createdAt: string;
}

export type IssueStatus = "ALL" | "REPORTED" | "IN_REVIEW" | "RESOLVED" | "DISCARDED" | "CLOSED"
export type IssueSort = "ALL" | "VIDEO" | "QUIZ" | "ARTICLE" | "QUESTION";

export default function CourseIssueReports() {
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<IssueStatus>('ALL');
  const [issueSort, setIssueSort] = useState<IssueSort>('ALL');
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
                      const detail = issue.detail || {};
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
                            {detail.course || '-'}
                          </TableCell>

                          <TableCell className="py-4">
                            {detail.type || '-'}
                          </TableCell>

                          <TableCell className="py-4">
                            <Badge
                              variant={
                                issue.status === "RESOLVED" || issue.status === "CLOSED"
                                  ? "default"
                                  : issue.status === "DISCARDED"
                                    ? "destructive"
                                    : issue.status === "IN_REVIEW"
                                      ? "secondary"
                                      : "outline"
                              }
                            >
                              {issue.status.charAt(0).toUpperCase() + issue.status.slice(1).toLowerCase()}
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

const formatKey = (key: string) => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (str) => str.toUpperCase());
};

export function IssueDetailsDialog({
  issue,
  onClose,
}: IssueDetailsDialogProps) {
  if (!issue) return null;

  return (
    <Dialog open={!!issue} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto py-8">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertCircle className="h-5 w-5 text-primary" />
            Issue Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {Object.entries(issue.detail).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {formatKey(key)}
                    </span>
                    <span className="font-medium break-words">
                      {value as string}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <p className="text-sm text-muted-foreground">
                Reported on:{" "}
                {new Date(issue.createdAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </CardContent>
          </Card>
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
  issueSort: IssueSort;
  setIssueSort: (val: IssueSort) => void;
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
        onValueChange={(value: IssueSort) => {
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