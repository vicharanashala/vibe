"use client"

import { useState, useEffect } from "react"
import { redirect, useNavigate } from "@tanstack/react-router"
import { Users, BookOpen, FileText, List, Play, AlertTriangle, X, Loader2, Eye, Clock, ChevronRight, ChevronDown, ArrowUp, ArrowDown,Pencil } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Import hooks - including the new quiz hooks
import {
  useGetReports,
   useCourseById,
  useCourseVersionById,
  useItemsBySectionId,
  useCourseVersionEnrollments,
  useResetProgress,
  useUnenrollUser,
  useUpdateReportStatus
} from "@/hooks/hooks"
import { useFlagStore } from "@/store/flag-store"
import type { EnrolledUser } from "@/types/course.types"
import { FlagModal } from "@/components/FlagModal"
import { ReportStatus } from "@/types/reports.types"


export default function FlaggedList() {
  const navigate = useNavigate()

  // Get course info from store
  const { currentCourseFlag } = useFlagStore()
  const courseId = currentCourseFlag?.courseId
  const versionId = currentCourseFlag?.versionId

  if (!currentCourseFlag || !courseId || !versionId) {
    navigate({ to: '/teacher/courses/list' });
    return null
  }

  // Fetch reports based on course id and version id
  const { data: flagsData, isLoading: reportLoading, error: reportError } = useGetReports(courseId || "",versionId || "")
  const { data: course, isLoading: courseLoading, error: courseError } = useCourseById(courseId || "")
  const { data: version, isLoading: versionLoading, error: versionError } = useCourseVersionById(versionId || "")
  const {
    mutate,
    isPending,
    isSuccess,
    isError,
    error,
    reset
  } = useUpdateReportStatus();

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isViewProgressDialogOpen, setIsViewProgressDialogOpen] = useState(false)
  const [resetScope, setResetScope] = useState<"course" | "module" | "section" | "item">("course")
  const [selectedModule, setSelectedModule] = useState<string>("")
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedItem, setSelectedItem] = useState<string>("")

  // New states for view progress functionality
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [selectedViewItem, setSelectedViewItem] = useState<string>("")
  const [selectedViewItemType, setSelectedViewItemType] = useState<string>("")
  const [selectedViewItemName, setSelectedViewItemName] = useState<string>("")
  const [selectedReportId, setSelectedReportId] = useState<string>("")

  // Fetch enrollments data
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
    refetch: refetchEnrollments,
  } = useCourseVersionEnrollments(courseId, versionId, 1, 100, !!(courseId && versionId))


  // Show all enrollments regardless of role or status
  const studentEnrollments = enrollmentsData?.enrollments || []
  const reports = flagsData?.reports || []

  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'enrollmentDate' | 'progress'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const filteredUsers = studentEnrollments;


  // Sorting logic
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = ((a.user?.firstName || '') + ' ' + (a.user?.lastName || '')).toLowerCase()
      const nameB = ((b.user?.firstName || '') + ' ' + (b.user?.lastName || '')).toLowerCase()
      if (nameA < nameB) return sortOrder === 'asc' ? -1 : 1
      if (nameA > nameB) return sortOrder === 'asc' ? 1 : -1
      return 0
    } else if (sortBy === 'enrollmentDate') {
      const dateA = new Date(a.enrollmentDate).getTime()
      const dateB = new Date(b.enrollmentDate).getTime()
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
    } else if (sortBy === 'progress') {
      const progA = (a.progress?.percentCompleted || 0)
      const progB = (b.progress?.percentCompleted || 0)
      return sortOrder === 'asc' ? progA - progB : progB - progA
    }
    return 0
  })
  console.log("Sorted Users:", reports)

  // Sorting handler
  const handleSort = (column: 'name' | 'enrollmentDate' | 'progress') => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

    // Flag handling function
  const handleStatusUpdate = async (comment: string,status:ReportStatus) => {
    try {
      console.log(comment,status,selectedReportId)
     mutate({
  params: {
    path: {
      reportId: selectedReportId,
    },
  },
  body: {
    status: status,
    comment: comment,
  },
});
     
    }catch(error){

    } finally { setUpdateStatusModalOpen(false);
    }
  };

  useEffect(() => {
    if (isResetDialogOpen) {
      setResetScope("course")
      setSelectedModule("")
      setSelectedSection("")
      setSelectedItem("")
    }
  }, [isResetDialogOpen])

  useEffect(() => {
    if (isViewProgressDialogOpen) {
      setExpandedModules(new Set())
      setExpandedSections(new Set())
      setSelectedViewItem("")
      setSelectedViewItemType("")
      setSelectedViewItemName("")
    }
  }, [isViewProgressDialogOpen])


  // Loading state
  if (courseLoading  || enrollmentsLoading || reportLoading) {
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
                    <TableRow className="border-border bg-muted/30">
                      {[
                        { key: 'reason', label: 'Reason', className: 'pl-6 w-[300px]' },
                        { key: 'reportedBy', label: 'Reported by', className: 'w-[120px]' },
                        { key: 'createdDate', label: 'Reported on', className: 'w-[200px]' },
                      ].map(({ key, label, className }) => (
                        <TableHead
                          key={key}
                          className={`font-bold text-foreground cursor-pointer select-none ${className}`}
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
                    {reports.map((report) => (<>
                      <TableRow
                        key={report._id}
                        className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                        onClick={()=>{
                           setSelectedReportId((prevId) =>
    prevId === report._id ? null : report._id
  );
                                                  }}
                      >
                        <TableCell className="pl-6 py-6">
                          <span>{report.reason}</span>
                                       </TableCell>
                        <TableCell className="py-6">
                           
                            <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md group-hover:border-primary/40 transition-colors duration-200">
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
                              <p className="font-bold text-foreground truncate text-lg">
                                {report.reportedBy.firstName + " " + report.reportedBy.lastName || "Unknown User"}
                              </p>
                             
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="text-muted-foreground font-medium">
                            {new Date(report.updatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="py-6 pr-6">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                               {setUpdateStatusModalOpen(true);
                                setSelectedReportId(report.id)
                               }
                              }
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-200 cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                             Update Status
                            </Button>
                           
                          </div>
                        </TableCell>
                       <TableCell>
                        <ChevronDown
        className={`h-5 w-5 text-muted-foreground transform transition-transform duration-200 ${
          selectedReportId ===report._id ? "rotate-180" : ""
        }`}
      />
                       </TableCell>
                      </TableRow>
                      <TableRow>
                         {selectedReportId ===report._id&&<TableCell>
                          <Card className="w-full bg-card/50 border-l-4 border-l-primary/40 hover:shadow-md transition-all duration-200">
  <CardContent className="p-6">
    <h4 className="text-lg font-semibold text-foreground mb-4">Flag History</h4>
    <div className="relative border-l-2 border-primary/30 pl-6 space-y-6">
      {report.status.length>0&&report.status.map((item) => (
        <div key={item.id} className="relative">
          {/* Dot */}
          <div className="absolute -left-[13px] top-1.5 w-3 h-3 bg-primary border-2 border-white rounded-full shadow" />

          {/* User Info + Comment */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* <Avatar className="h-10 w-10 border shadow">
                <AvatarImage src="/placeholder.svg" alt={item.user.firstName} />
                <AvatarFallback className="bg-primary text-white font-bold">
                  {(item.user.firstName?.[0] ?? "?") + (item.user.lastName?.[0] ?? "")}
                </AvatarFallback>
              </Avatar> */}
              <div>
                <p className="font-semibold text-foreground leading-tight">
                  {/* {item.user.firstName + " " + item.user.lastName} */}
                </p>
                {/* <p className="text-sm text-muted-foreground">{item.user.email}</p> */}
              </div>
            </div>
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              {new Date(item.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Comment */}
          <p className="mt-2 ml-1 text-muted-foreground">{item.comment}</p>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
</TableCell>}
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
                  
                />
      </div>
    </div>

    
  )
}
