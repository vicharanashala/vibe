"use client"

import { useState, useEffect } from "react"
import {  useNavigate } from "@tanstack/react-router"
import { Users, Loader2,  ChevronDown, ArrowUp, ArrowDown,Pencil } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Import hooks - including the new quiz hooks
import {
  useGetReports,
   useCourseById,
  useCourseVersionById,
 
  useUpdateReportStatus
} from "@/hooks/hooks"
import { useFlagStore } from "@/store/flag-store"
import { useQueryClient } from "@tanstack/react-query"
import { FlagModal } from "@/components/FlagModal"
import { ReportStatus } from "@/types/reports.types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Pagination } from "@/components/ui/Pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReportEntityEntity } from "@/types/flag.types"


export default function FlaggedList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

 const statusOptions = ["ALL", "REPORTED","IN_REVIEW", "RESOLVED", "DISCARDED", "CLOSED"]; 
 const EntityOptions = ["ALL", "VIDEO","QUIZ", "ARTICLE", "QUESTION"]; 
const pageLimit=10;

 const [selectedStatus, setSelectedStatus] = useState("ALL");
 const [selectedEntityType, setSelectedEntityType] = useState("ALL");
  
  // Get course info from store
  const { currentCourseFlag } = useFlagStore()
  const courseId = currentCourseFlag?.courseId
  const versionId = currentCourseFlag?.versionId
  
  if (!currentCourseFlag || !courseId || !versionId) {
    navigate({ to: '/teacher/courses/list' });
    return null
  }
 const [currentPage, setCurrentPage] = useState(1)
  // Fetch reports based on course id and version id
  const { data: flagsData, isLoading: reportLoading, error: reportError } = useGetReports(courseId || "",versionId || "",pageLimit,currentPage,selectedStatus,selectedEntityType)
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

  // Show all reports regardless 

  const reports = flagsData?.reports || []


  // const filteredReports = selectedStatus === "ALL"
  // ? reports
  // : reports.filter((report:any) => report.latestStatus === selectedStatus);

 
  const totalDocuments =flagsData?.totalDocuments || 0
  const totalPages = flagsData?.totalPages || 1

  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'enrollmentDate' | 'progress'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')



  // Sorting handler
  const handleSort = (column: 'name' | 'enrollmentDate' | 'progress') => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
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

    await queryClient.invalidateQueries({
      queryKey: ['get', '/reports/{courseId}/{versionId}'],
    });

    toast.success("Status updated successfully");
  } catch (error) {
    toast.error("Failed to update status");
    console.error("Error while updating report status:", error);
  } finally {
    setUpdateStatusModalOpen(false);
    setSelectedReport(null)
  }
};


  // Loading state
  if (courseLoading  ||  reportLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading course data...</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (courseError || reportError || !course || !version) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load course data</h3>
            <p className="text-muted-foreground mb-4">
              {courseError  || reportError || "Course or version not found"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        {/* Enhanced Header */}
             <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
             Course Flags
            </h1>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-gradient-to-b from-primary to-accent rounded-full"></div>
                <h2 className="text-2xl font-bold text-foreground">{course.name}</h2>
                <span className="text-lg text-muted-foreground">•</span>
                <h3 className="text-xl font-semibold text-accent">{version.version}</h3>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-primary to-accent rounded-full ml-4"></div>
            </div>
          </div>
         
        </div>
        <div className="flex items-center gap-4 mt-4">
  <label htmlFor="statusFilter" className="text-sm font-medium text-muted-foreground">Filter by Status:</label>
  <Select value={selectedStatus}  onValueChange={(value) => {
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
  <label htmlFor="statusFilter" className="text-sm font-medium text-muted-foreground">Filter by Status:</label>
  <Select value={selectedEntityType}  onValueChange={(value) => {
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
        
               {/* Flags Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          
          <CardContent className="p-0">
            {reports.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-foreground text-xl font-semibold mb-2">No Flags found</p>
                <p className="text-muted-foreground">
                  { "No students have reported this entity in this course version"}
                </p>
              </div>
            ) : (
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
                          onClick={() => handleSort(key as 'name' | 'enrollmentDate' | 'progress')}
                        >
                          <span className="flex items-center gap-1">
                            {label}
                            {sortBy === key && (
                              sortOrder === 'asc'
                                ? <ArrowUp size={16} className="text-foreground" />
                                : <ArrowDown size={16} className="text-foreground" />
                            )}
                          </span>
                        </TableHead>
                      ))}
                      <TableHead className="font-bold text-foreground pr-6 w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report:any) => (<>
                      <TableRow
                        key={report._id}
                        className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                         onClick={() => {
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
                                       <TableCell className="pl-6 py-6">
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
                                  .join('') || (report.reportedBy.firstName?.[0]?.toUpperCase() ||report.reportedBy.lastName?.[0]?.toUpperCase() || '?')}
                              </AvatarFallback>
                            </Avatar>
                           <div className="min-w-0 flex-1">
                           <p className="font-semibold text-foreground text-lg overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]"
                              title={`${report.reportedBy.firstName} ${report.reportedBy.lastName}`}
                            >
                              {report.reportedBy.firstName + " " + report.reportedBy.lastName || "Unknown User"}
                            </p>
                          </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="text-muted-foreground font-medium ">
                            {new Date(report.updatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="py-6 pr-6">
                          <div className="flex items-center gap-3">
                            {report.latestStatus!=="DISCARDED" && report.latestStatus!=="CLOSED" &&
                              <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                               {setUpdateStatusModalOpen(true);
                                setSelectedReport({ id: report._id, status: report.latestStatus });
                               }
                              }
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-200 cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                             Update Status
                            </Button>
                          }
                           
                          </div>
                        </TableCell>
                      
                      </TableRow>
                      <TableRow>
                         {selectedReport?.id === report._id && (
  <Dialog open={selectedReport?.id === report._id} onOpenChange={() => setSelectedReport(null)}>
    <DialogContent className="sm:max-w-2xl max-h-[80vh]">
      <DialogHeader>
        <DialogTitle className="mb-3 md:mb-5 underline">Flag History</DialogTitle>
      </DialogHeader>
      <ScrollArea className="h-[65vh] pr-4">
        <Card className="bg-card/50 border-l-4 border-l-primary/40">
          <CardContent className="p-6">
            <div className="relative border-l-2 border-primary/30 pl-6 space-y-6">
              {report.status.length > 0 && report.status.map((item,index) => (
              <div key={item.id} className="relative pb-6 last:pb-0 group">
                  {!(index+1 === report.status.length) && (
                    <div className="absolute -left-[9px] top-4 bottom-0 w-0.5 bg-primary/30"></div>
                  )}
                  <div className="absolute -left-[13px] top-1.5 z-10 w-3.5 h-3.5 bg-primary border-2 border-background rounded-full shadow-md" />

                  <div className="bg-background/80 group-hover:bg-accent/50 transition-colors duration-200 rounded-lg p-4  border border-border/50 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'RESOLVED' ? 'bg-green-100 text-green-800' : 
                          item.status === 'IN_REVIEW' ? 'bg-yellow-100 text-yellow-800' : 
                          item.status === 'DISCARDED' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
    
                      <div className="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" fill="none"                 viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pl-1 border-l-2 border-accent/30 pl-3 py-1">
                      <p className="text-sm text-foreground">
                        {item.comment || (
                          <span className="italic text-muted-foreground/70">No additional comments</span>
                        )}
                      </p>
                    </div>
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </ScrollArea>
    </DialogContent>
  </Dialog>)
}
                      </TableRow></>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
     <FlagModal
                  open={updateStatusModalOpen}
                  onOpenChange={setUpdateStatusModalOpen}
                  onSubmit={handleStatusUpdate}
                  isSubmitting={false}
                  teacher={true}
                  selectedStatus={selectedReport?.status}
                  
                />
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
