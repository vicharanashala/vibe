"use client"

import { useState, useEffect } from "react"
import { redirect, useNavigate } from "@tanstack/react-router"
import { Search, Users, TrendingUp, CheckCircle, RotateCcw, UserX, BookOpen, FileText, List, Play, AlertTriangle, X, Loader2, Eye, Clock, ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Pagination } from "@/components/ui/Pagination"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { QuizSubmissionDisplay } from "./QuizSubmissionDisplay"
import { WatchTimeDisplay } from "./WatchTimeDisplay"

// Import hooks - including the new quiz hooks
import {
  useCourseById,
  useCourseVersionById,
  useItemsBySectionId,
  useCourseVersionEnrollments,
  useResetProgress,
  useUnenrollUser
} from "@/hooks/hooks"
import { useCourseStore } from "@/store/course-store"
import type { EnrolledUser } from "@/types/course.types"

// Types for quiz functionality
interface IAttemptDetails {
  attemptId: string | ObjectId;
  submissionResultId?: string | ObjectId;
}

interface UserQuizMetricsResponse {
  _id?: string;
  quizId: string;
  userId: string;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED' | 'SKIPPED';
  latestAttemptId?: string;
  latestSubmissionResultId?: string;
  remainingAttempts: number;
  attempts: IAttemptDetails[];
}

interface IQuestionAnswerFeedback {
  questionId: string;
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
  score: number;
  answerFeedback?: string;
}

interface IGradingResult {
  totalScore?: number;
  totalMaxScore?: number;
  overallFeedback?: IQuestionAnswerFeedback[];
  gradingStatus: 'PENDING' | 'PASSED' | 'FAILED' | any;
  gradedAt?: string;
  gradedBy?: string;
}

interface QuizSubmissionResponse {
  _id?: string;
  quizId: string;
  userId: string;
  attemptId: string;
  submittedAt: string;
  gradingResult?: IGradingResult;
}

// Helper function to generate default names for items with empty names
function generateDefaultItemNames(items: any[]) {
  const typeCounts: { [key: string]: number } = {}
  return items.map((item) => {
    if (!item.name || item.name.trim() === "") {
      const type = item.type || "Item"
      const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
      if (!typeCounts[type]) {
        typeCounts[type] = 0
      }
      typeCounts[type]++
      return {
        ...item,
        displayName: `${capitalizedType} ${typeCounts[type]}`,
      }
    }
    return {
      ...item,
      displayName: item.name,
    }
  })
}

// Component to display progress for each enrolled user
// Accepts either a number (percent or fraction) or an object with a progress property
function EnrollmentProgress(props: { progress: number }) {
  // Support both direct number and object prop
  const progress = props.progress;
  return (
    <div className={`flex  items-center gap-4 w-40 ${getProgressBg(progress)}`}>
      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden shadow-inner">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(progress)}`}
          style={{
            width: `${progress.toFixed(1)}%`,
            transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
      <span className="text-sm font-bold text-foreground min-w-[3rem] text-right">
        {progress.toFixed(1)}%
      </span>
    </div>
  )
}

const getProgressColor = (progress: number) => {
  if (progress >= 80) return "from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500"
  if (progress >= 50) return "from-amber-500 to-amber-600 dark:from-amber-400 dark:to-amber-500"
  return "from-red-500 to-red-600 dark:from-red-400 dark:to-red-500"
}

const getProgressBg = (progress: number) => {
  if (progress >= 80) return "bg-emerald-50 dark:bg-emerald-950/30"
  if (progress >= 50) return "bg-amber-50 dark:bg-amber-950/30"
  return "bg-red-50 dark:bg-red-950/30"
}



export default function CourseEnrollments() {
  const navigate = useNavigate()

  // Get course info from store
  const { currentCourse } = useCourseStore()
  const courseId = currentCourse?.courseId
  const versionId = currentCourse?.versionId

  if (!currentCourse || !courseId || !versionId) {
    navigate({ to: '/teacher/courses/list' });
    return null
  }

  // Fetch course and version data
  const { data: course, isLoading: courseLoading, error: courseError } = useCourseById(courseId || "")
  const { data: version, isLoading: versionLoading, error: versionError } = useCourseVersionById(versionId || "")

  const [selectedUser, setSelectedUser] = useState<EnrolledUser | null>(null)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isViewProgressDialogOpen, setIsViewProgressDialogOpen] = useState(false)
  const [userToRemove, setUserToRemove] = useState<EnrolledUser | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
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

  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'enrollmentDate' | 'progress'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  //Pagination state
    const [currentPage, setCurrentPage] = useState(1)
  const pageLimit = 2;

const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

useEffect(() => {
  const handler = setTimeout(() => {
    setDebouncedSearch(searchQuery);
  }, 300); // debounce delay (ms)

  return () => {
    clearTimeout(handler);
  };
}, [searchQuery]);

    // Fetch enrollments data
const {
  data: enrollmentsData,
  isLoading: enrollmentsLoading,
  error: enrollmentsError,
  refetch: refetchEnrollments,
} = useCourseVersionEnrollments(
  courseId,
  versionId,
  currentPage,
  pageLimit,
  debouncedSearch,
  sortBy,
  sortOrder,
  !!(courseId && versionId)
);


  // API Hooks
  const resetProgressMutation = useResetProgress()
  const unenrollMutation = useUnenrollUser()

  // Pagination state
    const totalDocuments = enrollmentsData?.totalDocuments || 0
  const totalPages = enrollmentsData?.totalPages || 1


  // Sorting handler
  const handleSort = (column: 'name' | 'enrollmentDate' | 'progress') => {
    // if(column== "progress" ) return;
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

  const handleResetProgress = (user: EnrolledUser) => {
    setSelectedUser(user)
    setIsResetDialogOpen(true)
  }

  const handleViewProgress = (user: EnrolledUser) => {
    console.log("Viewing progress for user:", user)
    setSelectedUser(user)
    setIsViewProgressDialogOpen(true)
  }

  const handleRemoveStudent = (user: EnrolledUser) => {
    setUserToRemove(user)
    setIsRemoveDialogOpen(true)
  }

  const confirmRemoveStudent = async () => {
    if (userToRemove && courseId && versionId) {
      console.log("Removing student:", userToRemove)
      try {
        await unenrollMutation.mutateAsync({
          params: {
            path: {
              userId: userToRemove.id,
              courseId: courseId,
              courseVersionId: versionId,
            },
          },
        })
        setIsRemoveDialogOpen(false)
        setUserToRemove(null)
        refetchEnrollments()
      } catch (error) {
        console.error("Failed to remove student:", error)
      }
    }
  }

  const handleConfirmReset = async () => {
    if (!selectedUser || !courseId || !versionId) return

    try {
      const userId = selectedUser.id;
      const requestBody: any = {}

      if (resetScope === "module" && selectedModule) {
        requestBody.moduleId = selectedModule
      } else if (resetScope === "section" && selectedModule && selectedSection) {
        requestBody.moduleId = selectedModule
        requestBody.sectionId = selectedSection
      } else if (resetScope === "item" && selectedModule && selectedSection && selectedItem) {
        requestBody.moduleId = selectedModule
        requestBody.sectionId = selectedSection
        requestBody.itemId = selectedItem
      }

      await resetProgressMutation.mutateAsync({
        params: {
          path: {
            userId: userId,
            courseId: courseId,
            courseVersionId: versionId,
          },
        },
        body: requestBody,
      })

      setIsResetDialogOpen(false)
      setSelectedUser(null)
      refetchEnrollments()
    } catch (error) {
      console.error("Failed to reset progress:", error)
    }
  }

  // Get available modules from version data
  const getAvailableModules = () => {
    return version?.modules || []
  }

  // Get available sections from selected module
  const getAvailableSections = () => {
    if (!selectedModule || !version?.modules) return []
    const module = version.modules.find((m: any) => m.moduleId === selectedModule)
    return module?.sections || []
  }

  // Get available items from selected section
  const getAvailableItems = () => {
    if (!selectedModule || !selectedSection || !version?.modules) return []
    const module = version.modules.find((m: any) => m.moduleId === selectedModule)
    const section = module?.sections.find((s: any) => s.sectionId === selectedSection)
    return section?.items || []
  }

  const isFormValid = () => {
    switch (resetScope) {
      case "course":
        return true
      case "module":
        return !!selectedModule
      case "section":
        return !!selectedModule && !!selectedSection
      case "item":
        return !!selectedModule && !!selectedSection && !!selectedItem
      default:
        return false
    }
  }

  const getItemIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case "VIDEO":
        return "🎥"
      case "QUIZ":
        return "❓"
      case "ARTICLE":
      case "BLOG":
        return "📖"
      default:
        return "📄"
    }
  }

  // Toggle functions for expanding/collapsing modules and sections
  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId)
    } else {
      newExpanded.add(moduleId)
    }
    setExpandedModules(newExpanded)
  }

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }
  // Stats calculations based on filtered users (search results)
  const totalUsers = enrollmentsData?.totalDocuments
  // Count users with 100% progress
  const completedUsers = enrollmentsData?.enrollments?.filter(
    (enrollment: any) => (enrollment.progress?.percentCompleted || 0) >= 1
  ).length
  // Calculate average progress (as percent, rounded to 1 decimal)
  const averageProgress =
    totalUsers > 0
      ? (
        enrollmentsData?.enrollments?.reduce(
          (sum: number, enrollment: any) => sum + ((enrollment.progress?.percentCompleted || 0) * 100),
          0
        ) / totalUsers
      ).toFixed(1)
      : 0

  const stats = [
    {
      title: "Total Enrolled",
      value: totalUsers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Completed",
      value: completedUsers,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Avg. Progress",
      value: `${averageProgress}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ]

  // Loading state
  if ((courseLoading || versionLoading || enrollmentsLoading )&& !searchQuery) {
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
  if (courseError || versionError || enrollmentsError || !course || !version) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load course data</h3>
            <p className="text-muted-foreground mb-4">
              {courseError || versionError || enrollmentsError || "Course or version not found"}
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
              Course Enrollments
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
          <div className="flex items-center gap-3">
            <Button
              className="gap-2 bg-primary hover:bg-accent text-primary-foreground cursor-pointer"
              onClick={() => {
                const { setCurrentCourse } = useCourseStore.getState()
                setCurrentCourse({
                  courseId: courseId || "",
                  versionId: versionId || "",
                  moduleId: null,
                  sectionId: null,
                  itemId: null,
                  watchItemId: null,
                })
                navigate({ to: "/teacher/courses/invite" })
              }}
            >
              Send Invites
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search students by user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 border-border bg-card text-card-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
          </div>
        </div>

        {/* Students Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-r from-card to-muted/20">
            <CardTitle className="text-xl font-medium text-card-foreground">Enrolled Students</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {enrollmentsData?.enrollments?.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-foreground text-xl font-semibold mb-2">No students found</p>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try adjusting your search terms" : "No students are enrolled in this course version"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/30">
                      {[
                        { key: 'name', label: 'Student', className: 'pl-6 w-[300px]' },
                        { key: 'enrollmentDate', label: 'Enrolled', className: 'w-[120px]' },
                        { key: 'progress', label: 'Progress', className: 'w-[200px]' },
                      ].map(({ key, label, className }) => (
                        <TableHead
                          key={key}
                          className={`font-bold text-foreground cursor-pointer select-none ${className}`}
                          onClick={() => handleSort(key as 'name' | 'enrollmentDate' | 'progress')}
                        >
                          <span className="flex items-center gap-1" >
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
                    {enrollmentsData?.enrollments?.map((enrollment:any) => (
                      <TableRow
                        key={enrollment._id}
                        className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                      >
                        <TableCell className="pl-6 py-6">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md group-hover:border-primary/40 transition-colors duration-200">
                              <AvatarImage src="/placeholder.svg" alt={enrollment.email} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
                                {[
                                  enrollment?.user?.firstName?.[0],
                                  enrollment?.user?.lastName?.[0],
                                ]
                                  .filter(Boolean)
                                  .map((ch) => ch.toUpperCase())
                                  .join('') || (enrollment?.user?.firstName?.[0]?.toUpperCase() || enrollment?.user?.lastName?.[0]?.toUpperCase() || '?')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate text-base md:text-lg">
                                {enrollment?.user?.firstName + " " + enrollment?.user?.lastName || "Unknown User"}
                              </p>
                              <p className="text-xs md:text-sm text-muted-foreground truncate">{enrollment?.user?.email || ""}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="text-muted-foreground font-medium">
                            {new Date(enrollment.enrollmentDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <EnrollmentProgress progress={Math.round((enrollment.progress?.percentCompleted || 0) * 100)} />
                        </TableCell>
                        <TableCell className="py-6 pr-6">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleViewProgress({
                                  id: enrollment.user.userId,
                                  name: `${enrollment?.user?.firstName} ${enrollment?.user?.lastName}`,
                                  email: enrollment.userId,
                                  enrolledDate: enrollment.enrollmentDate,
                                  progress:Math.round((enrollment.progress?.percentCompleted || 0) * 100)
                                    })}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-200 cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Progress
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleResetProgress({
                                  id: enrollment.user.userId,
                                  name: `${enrollment?.user?.firstName} ${enrollment?.user?.lastName}`,
                                  email: enrollment.userId,
                                  enrolledDate: enrollment.enrollmentDate,
                                  progress: 0,
                                })
                              }
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all duration-200 cursor-pointer"
                              disabled={resetProgressMutation.isPending || Math.round((enrollment.progress?.percentCompleted || 0) * 100) == 0}
                            >
                              {resetProgressMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4 mr-2" />
                              )}
                              Reset
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveStudent({
                                  id: enrollment.user.userId,
                                  name: `${enrollment?.user?.firstName} ${enrollment?.user?.lastName}`,
                                  email: enrollment.user.email,
                                  enrolledDate: enrollment.enrollmentDate,
                                  progress: 0,
                                })
                              }
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 cursor-pointer"
                              disabled={unenrollMutation.isPending}
                            >
                              {unenrollMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4 mr-2" />
                              )}
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced View Progress Modal */}
        {isViewProgressDialogOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Enhanced Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
              onClick={() => setIsViewProgressDialogOpen(false)}
            />
            {/* Enhanced Modal */}
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-semibold text-card-foreground">Student Progress Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsViewProgressDialogOpen(false)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Enhanced Student Info */}
              <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border">
                <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md">
                  <AvatarImage src={selectedUser.avatar || "/placeholder.svg"} alt={selectedUser.name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                    {selectedUser.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-card-foreground truncate text-base md:text-lg">{selectedUser.name}</p>
                  <p className="text-muted-foreground truncate">{selectedUser.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-2">Course Progress</p>
                  <EnrollmentProgress progress={(selectedUser.progress || 0) } />
                </div>
              </div>

              {/* Course Structure */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Course Structure</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto border border-border rounded-lg p-4">
                  {getAvailableModules().map((module: any) => (
                    <div key={module.moduleId} className="space-y-2">
                      {/* Module */}
                      <div
                        className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => toggleModule(module.moduleId)}
                      >
                        {expandedModules.has(module.moduleId) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <BookOpen className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-foreground">{module.name}</span>
                      </div>

                      {/* Sections */}
                      {expandedModules.has(module.moduleId) && (
                        <div className="ml-6 space-y-2">
                          {module.sections?.map((section: any) => (
                            <div key={section.sectionId} className="space-y-2">
                              <div
                                className="flex items-center gap-2 p-2 bg-muted/10 rounded-lg cursor-pointer hover:bg-muted/20 transition-colors"
                                onClick={() => toggleSection(section.sectionId)}
                              >
                                {expandedSections.has(section.sectionId) ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <FileText className="h-4 w-4 text-emerald-600" />
                                <span className="font-medium text-foreground">{section.name}</span>
                              </div>

                              {/* Items */}
                              {expandedSections.has(section.sectionId) && (
                                <SectionItems
                                  versionId={versionId!}
                                  moduleId={module.moduleId}
                                  sectionId={section.sectionId}
                                  selectedViewItem={selectedViewItem}
                                  onItemSelect={(itemId, itemType, itemName) => {
                                    setSelectedViewItem(itemId)
                                    setSelectedViewItemType(itemType)
                                    setSelectedViewItemName(itemName)
                                    console.log("Selected Item:", itemId, itemType, itemName)
                                    console.log("selected vars", selectedViewItem, selectedViewItemType, selectedViewItemName)
                                  }}
                                  getItemIcon={getItemIcon}
                                />
                              )}
                            </div>
                          )) || <p className="text-sm text-muted-foreground ml-6">No sections in this module</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Item Details Display */}
              {selectedViewItem && (
                <div className="space-y-4">
                  {selectedViewItemType?.toUpperCase() === 'QUIZ' ? (
                    <QuizSubmissionDisplay
                      userId={selectedUser.id}
                      quizId={selectedViewItem}
                      itemName={selectedViewItemName}
                    />
                  ) : (
                    <WatchTimeDisplay
                      userId={selectedUser.id}
                      itemId={selectedViewItem}
                      courseId={courseId!}
                      courseVersionId={versionId}
                      itemName={selectedViewItemName}
                      itemType={selectedViewItemType}
                    />
                  )}
                </div>
              )}

              {!selectedViewItem && (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select an item from the course structure above to view details.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Remove Student Confirmation Modal */}
        {isRemoveDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
              onClick={() => setIsRemoveDialogOpen(false)}
            />
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-10 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-card-foreground">Remove Student</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRemoveDialogOpen(false)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-8">
                <p className="text-lg text-card-foreground">
                  Want to remove <strong className="text-primary">{userToRemove?.name}</strong> from{" "}
                  <strong className="text-primary">
                    {course.name} ({version.version})
                  </strong>
                  ?
                </p>

                <div className="flex gap-4 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <strong>Warning:</strong> This action cannot be undone. The student will lose access to the course
                    version and all their progress data.
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsRemoveDialogOpen(false)}
                  className="min-w-[100px] cursor-pointer"
                >
                  No, Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmRemoveStudent}
                  disabled={unenrollMutation.isPending}
                  className="min-w-[100px] shadow-lg cursor-pointer"
                >
                  {unenrollMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    "Yes, Remove"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Reset Progress Modal */}
        {isResetDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
              onClick={() => setIsResetDialogOpen(false)}
            />
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full mx-4 p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-card-foreground">Reset Student Progress</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsResetDialogOpen(false)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {selectedUser && (
                <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border">
                  <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md">
                    <AvatarImage src={selectedUser.avatar || "/placeholder.svg"} alt={selectedUser.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                      {selectedUser.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-card-foreground truncate text-lg">{selectedUser.name}</p>
                    <p className="text-muted-foreground truncate">{selectedUser.email}</p>
                  </div>
                </div>
              )}

              <p className="text-muted-foreground">
                Choose the scope of progress reset for this student in{" "}
                <strong>
                  {course.name} ({version.version})
                </strong>
                . This action cannot be undone.
              </p>

              <div className="space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="reset-scope" className="text-sm font-bold text-foreground">
                    Reset Scope
                  </Label>
                  <Select value={resetScope} onValueChange={(value: any) => setResetScope(value)}>
                    <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
                      <SelectValue placeholder="Select reset scope" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border cursor-pointer">
                      <SelectItem value="course" className="cursor-pointer">
                        <div className="flex items-center gap-3 py-3 px-2">
                          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <div>
                            <div className="font-semibold">Entire Course Version</div>
                            <div className="text-xs text-muted-foreground">Reset all progress in this version</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="module" className="cursor-pointer" >
                        <div className="flex items-center gap-3 py-3 px-2">
                          <List className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <div className="font-semibold">Specific Module</div>
                            <div className="text-xs text-muted-foreground">Reset module progress</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="section" className="cursor-pointer" >
                        <div className="flex items-center gap-3 py-3 px-2">
                          <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <div className="font-semibold">Specific Section</div>
                            <div className="text-xs text-muted-foreground">Reset section progress</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="item" className="cursor-pointer" >
                        <div className="flex items-center gap-3 py-3 px-2">
                          <Play className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <div>
                            <div className="font-semibold">Specific Item</div>
                            <div className="text-xs text-muted-foreground">Reset single item</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(resetScope === "module" || resetScope === "section" || resetScope === "item") && (
                  <div className="space-y-3">
                    <Label htmlFor="module" className="text-sm font-bold text-foreground">
                      Module
                    </Label>
                    <Select value={selectedModule} onValueChange={setSelectedModule}>
                      <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
                        <SelectValue placeholder="Select module" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border cursor-pointer">
                        {getAvailableModules().map((module: any) => (
                          <SelectItem key={module.moduleId} value={module.moduleId} className="cursor-pointer">
                            <div className="py-2">
                              <div className="font-semibold">{module.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {module.sections?.length || 0} sections
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(resetScope === "section" || resetScope === "item") && selectedModule && (
                  <div className="space-y-3">
                    <Label htmlFor="section" className="text-sm font-bold text-foreground">
                      Section
                    </Label>
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                      <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border cursor-pointer">
                        {getAvailableSections().map((section: any) => (
                          <SelectItem key={section.sectionId} value={section.sectionId} className="cursor-pointer">
                            <div className="py-2">
                              <div className="font-semibold">{section.name}</div>
                              <div className="text-xs text-muted-foreground">Section in selected module</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {resetScope === "item" && selectedModule && selectedSection && (
                  <ItemSelector
                    versionId={versionId!}
                    moduleId={selectedModule}
                    sectionId={selectedSection}
                    selectedItem={selectedItem}
                    onItemChange={setSelectedItem}
                  />
                )}

                <div className="flex gap-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> This action cannot be undone. The student's progress will be permanently
                    reset for the selected scope.
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsResetDialogOpen(false)}
                  className="min-w-[100px] cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmReset}
                  disabled={!isFormValid() || resetProgressMutation.isPending}
                  className="min-w-[120px] shadow-lg cursor-pointer"
                >
                  {resetProgressMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Progress"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
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

// Component to handle item selection with API call
function ItemSelector({
  versionId,
  moduleId,
  sectionId,
  selectedItem,
  onItemChange,
}: {
  versionId: string
  moduleId: string
  sectionId: string
  selectedItem: string
  onItemChange: (itemId: string) => void
}) {
  const { data: itemsResponse, isLoading, error } = useItemsBySectionId(versionId, moduleId, sectionId)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-bold text-foreground">Item</Label>
        <div className="flex items-center gap-3 p-4 border rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading items...</span>
        </div>
      </div>
    )
  }

  if (error || !itemsResponse || !Array.isArray(itemsResponse) || itemsResponse.length === 0) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-bold text-foreground">Item</Label>
        <div className="p-4 border rounded-lg text-sm text-destructive">
          {error ? `Error loading items: ${error}` : "No items found in this section"}
        </div>
      </div>
    )
  }

  const getItemIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case "VIDEO":
        return "🎥"
      case "QUIZ":
        return "❓"
      case "ARTICLE":
      case "BLOG":
        return "📖"
      default:
        return "📄"
    }
  }

  const getItemTypeDisplay = (type: string) => {
    switch (type?.toUpperCase()) {
      case "VIDEO":
        return "Video"
      case "QUIZ":
        return "Quiz"
      case "ARTICLE":
        return "Article"
      case "BLOG":
        return "Blog"
      default:
        return type || "Unknown"
    }
  }

  const itemsWithDefaultNames = generateDefaultItemNames(itemsResponse)

  return (
    <div className="space-y-3">
      <Label htmlFor="item" className="text-sm font-bold text-foreground">
        Item
      </Label>
      <Select value={selectedItem} onValueChange={onItemChange}>
        <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
          <SelectValue placeholder="Select item" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border cursor-pointer">
          {itemsWithDefaultNames.map((item: any) => (
            <SelectItem key={item._id} value={item._id} className="cursor-pointer">
              <div className="flex items-center gap-3 py-2">
                <span className="text-lg">{getItemIcon(item.type)}</span>
                <div>
                  <div className="font-semibold">{item.displayName}</div>
                  <div className="text-xs text-muted-foreground">{getItemTypeDisplay(item.type)}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// Component to fetch and display items for a section
function SectionItems({
  versionId,
  moduleId,
  sectionId,
  selectedViewItem,
  onItemSelect,
  getItemIcon,
}: {
  versionId: string
  moduleId: string
  sectionId: string
  selectedViewItem: string
  onItemSelect: (itemId: string, itemType: string, itemName: string) => void
  getItemIcon: (type: string) => string
}) {
  const { data: itemsResponse, isLoading, error } = useItemsBySectionId(versionId, moduleId, sectionId)

  if (isLoading) {
    return (
      <div className="ml-6 p-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading items...</span>
        </div>
      </div>
    )
  }

  if (error || !itemsResponse || !Array.isArray(itemsResponse) || itemsResponse.length === 0) {
    return (
      <div className="ml-6 p-2">
        <p className="text-sm text-muted-foreground">
          {error ? `Error loading items: ${error}` : "No items in this section"}
        </p>
      </div>
    )
  }

  const itemsWithDefaultNames = generateDefaultItemNames(itemsResponse)

  return (
    <div className="ml-6 space-y-1">
      {itemsWithDefaultNames.map((item: any) => (
        <div
          key={item._id}
          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedViewItem === item._id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/10"
            }`}
          onClick={() => onItemSelect(item._id, item.type, item.displayName)}
        >
          <span className="text-lg">{getItemIcon(item.type)}</span>
          <span className="text-sm text-foreground">{item.displayName}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {item.type}
          </Badge>
        </div>
      ))}
    </div>
  )
}
