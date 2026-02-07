"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Users, Loader2, ChevronDown, ArrowUp, ArrowDown, Pencil, Flag, User, Clock, MessageSquare, BookOpen, ChevronRight } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Import hooks - including the new quiz hooks
import {
  useGetReports,
  useCourseById,
  useCourseVersionById,

  useUpdateReportStatus,
  useGetReportDetails
} from "@/hooks/hooks"
import { useFlagStore } from "@/store/flag-store"
import { useCourseStore } from "@/store/course-store"
import { useQueryClient } from "@tanstack/react-query"
import { FlagModal } from "@/components/FlagModal"
import { ReportStatus } from "@/types/reports.types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Pagination } from "@/components/ui/Pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReportEntityEntity } from "@/types/flag.types"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"


export default function FlaggedList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const statusOptions = ["ALL", "REPORTED", "IN_REVIEW", "RESOLVED", "DISCARDED", "CLOSED"];
  const EntityOptions = ["ALL", "VIDEO", "QUIZ", "ARTICLE", "QUESTION"];
  const pageLimit = 10;

  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedEntityType, setSelectedEntityType] = useState("ALL");

  // Get course info from store
  const { currentCourseFlag } = useFlagStore()
  const { setCurrentCourse } = useCourseStore()
  const courseId = currentCourseFlag?.courseId
  const versionId = currentCourseFlag?.versionId
  // Sorting state
  type SortField = (typeof SORT_MAP)[keyof typeof SORT_MAP]

  const [sortBy, setSortBy] = useState<SortField>('createdAt')

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  if (!currentCourseFlag || !courseId || !versionId) {
    navigate({ to: '/teacher' });
    return null
  }
  const [currentPage, setCurrentPage] = useState(1)
  // Fetch reports based on course id and version id
  const { data: flagsData, isLoading: reportLoading, error: reportError } = useGetReports(courseId || "", versionId || "", pageLimit, currentPage, selectedStatus, selectedEntityType, sortBy, sortOrder);

  const { data: course, isLoading: courseLoading, error: courseError } = useCourseById(courseId || "")
  const { data: version, isLoading: versionLoading, error: versionError } = useCourseVersionById(versionId || "")
  const {
    mutateAsync,
    isPending,
    isSuccess,
    isError,
    error,
    reset
  } = useUpdateReportStatus();



  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false)

  const [selectedReport, setSelectedReport] = useState<{ id: string; status: string } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const { data: selectedFlagData, error: selectedFlagError } = useGetReportDetails(selectedReport?.id);

  // Show all reports regardless 

  const reports = flagsData?.reports || []


  // const filteredReports = selectedStatus === "ALL"
  // ? reports
  // : reports.filter((report:any) => report.latestStatus === selectedStatus);


  const totalDocuments = flagsData?.totalDocuments || 0
  const totalPages = flagsData?.totalPages || 1




  const getStatusColor = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "bg-green-100 text-green-800 border-green-200"
      case "IN_REVIEW":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "DISCARDED":
        return "bg-red-100 text-red-800 border-red-200"
      case "REPORTED":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case "VIDEO":
        return "🎥"
      case "COURSE":
        return "📚"
      case "DOCUMENT":
        return "📄"
      default:
        return "📋"
    }
  }

  const SORT_MAP = {
    reason: 'reason',
    entityType: 'entityType',
    status: 'latestStatus',
    reportedBy: 'reportedBy.firstName',
    createdDate: 'createdAt',
  } as const

  type SortKey = keyof typeof SORT_MAP

  const handleSort = (columnKey: SortKey) => {
    const backendField = SORT_MAP[columnKey]

    setCurrentPage(1)

    if (sortBy === backendField) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(backendField)
      setSortOrder('asc')
    }
  }



  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  // Flag handling function
  const handleStatusUpdate = async (comment: string, status: ReportStatus) => {
    if (!selectedReport) {
      console.warn("Reported data is not defined", selectedReport);
      return;
    }
    try {
      await mutateAsync({
        params: {
          path: {
            reportId: selectedReport.id,
          },
        },
        body: {
          status,
          comment,
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['get', '/reports/{courseId}/{versionId}'] }),
        queryClient.invalidateQueries({ queryKey: ['get', '/reports/{reportId}'] }),
      ]);

      toast.success("Status updated successfully");
    } catch (error) {
      toast.error("Failed to update status");
      console.error("Error while updating report status:", error);
    } finally {
      setUpdateStatusModalOpen(false);
      setSelectedReport(null)
      setIsUpdatingStatus(false)
    }
  };

  // Navigation handler for flagged items
  const handleItemClick = () => {
    if (!selectedFlagData) return;





    // Extract courseId - handle both string and object types
    const extractedCourseId = typeof selectedFlagData.courseId === 'string'
      ? selectedFlagData.courseId
      : selectedFlagData.courseId._id;



    // Set course context for navigation
    const courseInfo = {
      courseId: extractedCourseId,
      versionId: selectedFlagData.versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: selectedFlagData.entityId, // Navigate to the flagged item
      questionId: selectedFlagData.questionId || null, // Include questionId for flagged questions
    };



    setCurrentCourse(courseInfo);

    // Navigate to course view
    navigate({ to: '/teacher/courses/view' });
  };

  // Loading state
  // if (courseLoading || reportLoading) {
  //   return (
  //     <div className="min-h-screen bg-background">
  //       <div className="container mx-auto py-8">
  //         <div className="flex items-center justify-center py-12">
  //           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  //           <span className="ml-2 text-muted-foreground">Loading course data...</span>
  //         </div>
  //       </div>
  //     </div>
  //   )
  // Error state
  if (courseError || !course || !version) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load course data</h3>
            <p className="text-muted-foreground mb-4">
              {courseError || reportError || "Course or version not found"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 space-y-8">
        {/* Enhanced Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Course Flags
            </h1>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-gradient-to-b from-primary to-accent rounded-full"></div>
                <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground">{course.name}</h2>
                <span className="text-lg text-muted-foreground">•</span>
                <h3 className="text-base md:text-lg lg:text-xl font-semibold text-accent">{version.version}</h3>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-primary to-accent rounded-full ml-4"></div>
            </div>
          </div>

        </div>
        <div className="md:flex items-center gap-4 mt-4">
          <div>
            <label htmlFor="statusFilter" className="text-sm font-medium text-muted-foreground">Filter by Status:</label>
            <Select value={selectedStatus} onValueChange={(value) => {
              setSelectedStatus(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "ALL" ? "All Statuses" : status.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 md:mt-0">
            <label htmlFor="statusFilter" className="text-sm font-medium text-muted-foreground">Filter by Type:</label>
            <Select value={selectedEntityType} onValueChange={(value) => {
              setSelectedEntityType(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EntityOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "ALL" ? "All Types" : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Flags Table */}
        <Card className="border-0 shadow-lg overflow-hidden">

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30 ">
                    {[
                      { key: 'reason', label: 'Reason', className: 'pl-6 w-[300px]' },
                      { key: 'entityType', label: 'Type', className: 'pl-6 w-[120px]' },
                      { key: 'status', label: 'Latest satus', className: 'w-[120px]' },
                      { key: 'reportedBy', label: 'Reported by', className: 'w-[120px]' },
                      { key: 'createdDate', label: 'Reported on', className: 'w-[200px]' },
                    ].map(({ key, label, className }) => (
                      <TableHead
                        key={key}
                        className={`font-bold text-foreground cursor-pointer select-none text-center align-middle ${className}`}
                        onClick={() => handleSort(key as SortKey)}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {sortBy === SORT_MAP[key as SortKey] && (
                            sortOrder === 'asc'
                              ? <ArrowUp size={16} />
                              : <ArrowDown size={16} />
                          )}

                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="font-bold text-foreground pr-6 w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-muted-foreground">Loading flags...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <Users className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <p className="text-foreground text-xl font-semibold mb-2">No Flags found</p>
                        <p className="text-muted-foreground">
                          {"No students have reported this entity in this course version"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report: any) => (
                      <TableRow
                        key={report._id}
                        className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                        onClick={() => {
                          console.log('📋 Clicked report item:', report);
                          if (selectedReport?.id === report._id) {
                            setSelectedReport(null);
                          } else {
                            setSelectedReport({ id: report._id, status: report.latestStatus });
                          }
                        }}

                      >
                        <TableCell className="pl-6 py-6 w-[250px] align-top">
                          <div className="max-h-[100px] overflow-y-auto  whitespace-pre-wrap break-words text-sm pr-2">
                            {report.reason}
                          </div>
                        </TableCell>
                        <TableCell className="pl-6 py-6">
                          <span className="text-center align-middle">{report.entityType}</span>
                        </TableCell>
                        <TableCell className=" py-6">
                          <span >{report.latestStatus}</span>
                        </TableCell>
                        <TableCell className="py-6">

                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-md group-hover:border-primary/40 transition-colors duration-200">
                              <AvatarImage src="/placeholder.svg" alt={report.reportedBy.firstName} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
                                {[
                                  report.reportedBy.firstName?.[0],
                                  report.reportedBy.lastName?.[0],
                                ]
                                  .filter(Boolean)
                                  .map((ch) => ch.toUpperCase())
                                  .join('') || (report.reportedBy.firstName?.[0]?.toUpperCase() || report.reportedBy.lastName?.[0]?.toUpperCase() || '?')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground text-base md:text-lg overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]"
                                title={`${report.reportedBy.firstName} ${report.reportedBy.lastName}`}
                              >
                                {[report.reportedBy?.firstName, report.reportedBy?.lastName].filter(Boolean).join(" ") || "Unknown User"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="text-muted-foreground font-medium ">
                            {new Date(report.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="py-6 pr-6 ">
                          {report.latestStatus !== "DISCARDED" && report.latestStatus !== "CLOSED" &&
                            <div className="flex items-center gap-3 border-2 border-blue-100 dark:border-blue-950 rounded-2xl w-fit">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsUpdatingStatus(true)
                                  setUpdateStatusModalOpen(true);
                                  setSelectedReport({ id: report._id, status: report.latestStatus });
                                }}
                                className="text-blue-600 hover:text-blue-500 hover:bg-transparent dark:hover:bg-transparent transition-all duration-200 cursor-pointer pointer-events-auto"
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Update Status
                              </Button>
                            </div>
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {selectedFlagData && selectedReport && (
          <Dialog open={!isUpdatingStatus && !!selectedFlagData} onOpenChange={() => setSelectedReport(null)}>
            <DialogContent className="lg:max-w-3xl md:max-w-2xl max-w-sm max-[425px]:w-[90vw] max-h-[85vh]">
              <DialogHeader className="pb-4">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Flag className="h-5 w-5 text-primary" />
                  Flag Report Details
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="h-[70vh] pr-4">
                <div className="space-y-6">
                  {/* Flag Overview */}
                  <Card className="border-l-4 border-l-primary">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            Reported by
                          </div>
                          <p className="font-medium">
                            {selectedFlagData.reportedBy.firstName} {selectedFlagData.reportedBy.lastName}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Reported on
                          </div>
                          <p className="font-medium">
                            {new Date(selectedFlagData.createdAt).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{getEntityTypeIcon(selectedFlagData.entityType)}</span>
                          Entity Type
                        </div>
                        <Badge variant="outline" className="font-medium">
                          {selectedFlagData.entityType}
                        </Badge>
                      </div>

                      <Separator className="my-4" />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          Reason for flagging
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 border">
                          <p className="text-sm leading-relaxed">
                            {selectedFlagData.reason || (
                              <span className="italic text-muted-foreground">No reason provided</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Module, Section, and Item Information */}
                  {(selectedFlagData.moduleName || selectedFlagData.sectionName || selectedFlagData.itemName) && (
                    <Card className="border-l-4 border-l-accent">
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-accent" />
                          Content Location
                        </h3>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          {selectedFlagData.moduleName && (
                            <>
                              <span className="text-muted-foreground font-medium">Module:</span>
                              <Badge variant="secondary" className="font-medium px-3 py-1">
                                {selectedFlagData.moduleName}
                              </Badge>
                              {(selectedFlagData.sectionName || selectedFlagData.itemName) && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </>
                          )}
                          {selectedFlagData.sectionName && (
                            <>
                              <span className="text-muted-foreground font-medium">Section:</span>
                              <Badge variant="secondary" className="font-medium px-3 py-1">
                                {selectedFlagData.sectionName}
                              </Badge>
                              {selectedFlagData.itemName && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </>
                          )}
                          {selectedFlagData.itemName && (
                            <>
                              <span className="text-muted-foreground font-medium">
                                {selectedFlagData.entityType === 'QUESTION' ? 'Question in:' : 'Item:'}
                              </span>
                              <Badge
                                variant="secondary"
                                className="font-medium px-3 py-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                                onClick={handleItemClick}
                                title={selectedFlagData.entityType === 'QUESTION'
                                  ? `Navigate to question in ${selectedFlagData.itemName}`
                                  : `Navigate to ${selectedFlagData.itemName}`}
                              >
                                {selectedFlagData.itemName}
                              </Badge>
                              {selectedFlagData.entityType === 'QUESTION' && selectedFlagData.questionId && (
                                <>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground font-medium">Question ID:</span>
                                  <Badge variant="outline" className="font-mono text-xs px-2 py-1">
                                    {selectedFlagData.questionId.slice(-8)}
                                  </Badge>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Status Timeline */}
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Status Timeline
                      </h3>

                      <div className="relative">
                        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border"></div>

                        <div className="space-y-6">
                          {selectedFlagData.status.map((item, index) => (
                            <div key={index} className="relative flex gap-4">
                              {/* Timeline dot */}
                              <div className="relative z-10 flex-shrink-0">
                                <div className="w-8 h-8 bg-background border-2 border-primary rounded-full flex items-center justify-center shadow-sm">
                                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 pb-6">
                                <div className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                    <Badge className={getStatusColor(item.status)}>{item.status.replace("_", " ")}</Badge>

                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {new Date(item.createdAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  </div>

                                  {item.comment && (
                                    <div className="bg-muted/30 rounded-md p-3 border-l-2 border-primary/30">
                                      <p className="text-sm text-foreground leading-relaxed">{item.comment}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Additional Info */}
                  <Card className="bg-muted/20">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Course :</span>
                          <p className="font-mono mt-1 break-all">{selectedFlagData.courseId.name}</p>
                        </div>
                        <div>
                          <span className="font-medium">Entity ID:</span>
                          <p className="font-mono mt-1 break-all">{selectedFlagData.entityId}</p>
                        </div>
                        <div>
                          <span className="font-medium">Last Updated:</span>
                          <p className="mt-1">
                            {new Date(selectedFlagData.updatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )
        }
        {selectedReport?.id &&
          <FlagModal
            open={updateStatusModalOpen}
            onOpenChange={(isOpen) => {
              setUpdateStatusModalOpen(isOpen);
              if (!isOpen) {
                setIsUpdatingStatus(false);
                setSelectedReport(null);
              }
            }}
            onSubmit={handleStatusUpdate}
            isSubmitting={false}
            teacher={true}
            selectedStatus={selectedReport?.status}

          />
        }
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalDocuments={totalDocuments}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>


  )
}
