"use client"

import { useState, useEffect, use } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronRight,
  BookOpen,
  Edit3,
  Eye,
  Save,
  X,
  FileText,
  Plus,
  Search,
  Trash2,
  Loader2,
  Users,
  Sparkles,
  GraduationCap,
  Clock,
  BarChart3,
  RotateCcw,
  FlagTriangleRight,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ProctoringModal } from "@/components/EditProctoringModal"
import { Pagination } from "@/components/ui/Pagination"
import { Badge } from "@/components/ui/badge"

// Import the hooks and auth store
import {
  useUpdateCourse,
  useDeleteCourse,
  useCreateCourseVersion,
  useDeleteCourseVersion,
  useUserEnrollments,
  useCourseById,
  useCourseVersionById,
  useEditProctoringSettings
} from "@/hooks/hooks"
import { useAuthStore } from "@/store/auth-store"
import { useCourseStore } from "@/store/course-store"
import { useFlagStore } from "@/store/flag-store"
import { bufferToHex } from "@/utils/helpers"

// Define types for better TypeScript support
import type { RawEnrollment } from "@/types/course.types"

export default function TeacherCoursesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const queryClient = useQueryClient()

  // Fetch user enrollments with pagination (use reasonable page size)
  const { token } = useAuthStore()
  const {
    data: enrollmentsResponse,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
    refetch,
  } = useUserEnrollments(currentPage, 10, !!token) // Use pagination with 10 items per page

  const enrollments = enrollmentsResponse?.enrollments || []
  const totalPages = enrollmentsResponse?.totalPages || 1
  const totalDocuments = enrollmentsResponse?.totalDocuments || 0
  const filteredEnrollements = enrollments.filter((enrollment) => enrollment.role !== "STUDENT");

  // Get unique courses (in case user is enrolled in multiple versions of same course)
  // Since we're using pagination, we'll work with the current page data
  const uniqueCourses = filteredEnrollements.reduce((acc: any[], enrollment: any) => {
    const courseIdHex = bufferToHex(enrollment.courseId)
    const existingCourse = acc.find((e) => bufferToHex(e.courseId) === courseIdHex)
    if (!existingCourse) {
      acc.push(enrollment)
    }
    return acc
  }, [])

  const navigate = useNavigate()
  const createNewCourse = () => {
    navigate({ to: "/teacher/courses/create" })
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  // Reset page to 1 when search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Filter courses based on search query
  const filteredCourses = uniqueCourses

  // Invalidate all related queries
  const invalidateAllQueries = () => {
    // Invalidate enrollments
    queryClient.invalidateQueries({
      queryKey: ['get', '/users/enrollments']
    })

    // Invalidate all course queries
    queryClient.invalidateQueries({
      queryKey: ["get", "/courses/{id}"],
    })

    // Invalidate all course version queries
    queryClient.invalidateQueries({
      queryKey: ["get", "/courses/versions/{id}"],
    })
  }

  // Loading state
  if (enrollmentsLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-xl animate-pulse"></div>
              <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
            </div>
            <span className="ml-3 text-muted-foreground font-medium">Loading your courses...</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (enrollmentsError) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-destructive/20 to-red-500/20 rounded-full blur-xl"></div>
              <div className="relative bg-destructive/10 border border-destructive/20 rounded-full p-4">
                <BookOpen className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load courses</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{enrollmentsError}</p>
            <Button onClick={() => refetch()} className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (uniqueCourses.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-xl animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-full p-6">
                <BookOpen className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">No courses found</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">Create your first course to start building amazing learning experiences</p>
            <Button
              onClick={createNewCourse}
              className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 px-8 group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center gap-2">
                <div className="relative">
                  <Plus className="h-4 w-4 mr-1 transition-transform duration-300 group-hover:rotate-90" />
                  <div className="absolute inset-0 bg-white/30 rounded-full blur-sm animate-ping opacity-75"></div>
                </div>
                <span className="font-semibold">Create New Course</span>
              </div>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section with Beautiful Design */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>
          <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
            <div className="lg:flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg blur-sm"></div>
                    <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                      <GraduationCap className="h-6 w-6 text-primary-foreground" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                      My Courses
                    </h1>
                    <div className="mt-1 flex items-center" style={{ minHeight: '1.5rem' }}>
                      <span className="inline-flex items-center justify-center" style={{ width: '1.5rem' }}>
                        <Sparkles className="h-4 w-4 text-primary" />
                      </span>
                      <span className="text-muted-foreground ml-2">Manage your courses and versions with ease</span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                onClick={createNewCourse}
                className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 h-12 px-8 group mt-4 lg:mt-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <div className="relative flex items-center gap-2">
                  <div className="relative">
                    <Plus className="h-4 w-4 mr-1 transition-transform duration-300 group-hover:rotate-90" />
                    <div className="absolute inset-0 bg-white/30 rounded-full blur-sm animate-ping opacity-75"></div>
                  </div>
                  <span className="font-semibold">Create New Course</span>
                </div>
              </Button>
            </div>
          </div>
        </div>

        {/* Search Section with Enhanced Design */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-xl blur-sm"></div>
          <div className="relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg blur-sm"></div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span>{filteredCourses.length} courses</span>
              </div>
            </div>
          </div>
        </div>

        {/* Courses List with Beautiful Cards */}
        <div className="space-y-6">
          {filteredCourses.map((enrollment: any, index: number) => (
            <div
              key={enrollment._id}
              className="animate-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CourseCard
                enrollment={enrollment}
                searchQuery={searchQuery}
                onInvalidate={invalidateAllQueries}
              />
            </div>
          ))}
        </div>

        {/* Pagination with Enhanced Design */}
        {totalPages > 1 && (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-muted/10 to-muted/5 rounded-xl blur-sm"></div>
            <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-xl p-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalDocuments={totalDocuments}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CourseCard({
  enrollment,
  searchQuery,
  onInvalidate,
}: {
  enrollment: RawEnrollment
  searchQuery: string
  onInvalidate: () => void
}) {
  const [showNewVersionForm, setShowNewVersionForm] = useState(false)
  const [newVersionData, setNewVersionData] = useState({ version: "", description: "" })
  const [expandedCourse, setExpandedCourse] = useState(false)
  const [editingCourse, setEditingCourse] = useState(false)
  const [editingValues, setEditingValues] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  })

  const [creatingErrors, setCreatingErrors] = useState<{ name?: string; description?: string }>({});
  const [editingErrors, setEditingErrors] = useState<{ name?: string; description?: string }>({});


  const queryClient = useQueryClient()

  // Convert buffers to hex strings for API compatibility
  const courseIdHex = bufferToHex(enrollment.courseId as any)

  // API Hooks
  const updateCourseMutation = useUpdateCourse()
  const deleteCourseMutation = useDeleteCourse()
  const createVersionMutation = useCreateCourseVersion()
  const deleteVersionMutation = useDeleteCourseVersion()

  // Fetch full course data
  const { data: course, isLoading: courseLoading, error: courseError } = useCourseById(courseIdHex)
  // Filter based on search query
  const matchesSearch =
    !searchQuery ||
    course?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course?.description?.toLowerCase().includes(searchQuery.toLowerCase())

  if (!matchesSearch) {
    return null
  }

  if (courseLoading) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm"></div>
        <Card className="relative bg-card/95 backdrop-blur-sm border border-border/50 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-sm animate-pulse"></div>
                <Loader2 className="h-6 w-6 animate-spin text-primary relative z-10" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted/50 rounded animate-pulse"></div>
                <div className="h-3 bg-muted/30 rounded w-2/3 animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (courseError || !course) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-destructive/5 to-red-500/5 rounded-xl blur-sm"></div>
        <Card className="relative bg-card/95 backdrop-blur-sm border border-destructive/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="text-center text-destructive">
              <div className="relative inline-block mb-2">
                <div className="absolute inset-0 bg-gradient-to-r from-destructive/20 to-red-500/20 rounded-full blur-sm"></div>
                <div className="relative bg-destructive/10 border border-destructive/20 rounded-full p-2">
                  <BookOpen className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <p className="font-medium">Error loading course data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const toggleCourse = () => {
    setExpandedCourse(!expandedCourse)
  }

  const startEditing = () => {
    setEditingCourse(true)
    setEditingValues({
      name: course.name,
      description: course.description,
    })
  }

  const cancelEditing = () => {
    setEditingCourse(false)
    setEditingValues({ name: "", description: "" })
    setEditingErrors({ name: "", description: "" })
  }

  const saveEditing = async () => {
    if (!editingValues.name.trim() || !editingValues.description.trim()) {
      setEditingErrors({ name: " Course name is required", description: " Course description is required" })
      return
    }
    else {
      setEditingErrors({ name: "", description: "" })
    }
    try {
      await updateCourseMutation.mutateAsync({
        params: { path: { id: courseIdHex } },
        body: {
          name: editingValues.name,
          description: editingValues.description,
        },
      })

      // Invalidate specific course query
      queryClient.invalidateQueries({
        queryKey: ["get", "/courses/{id}", { params: { path: { id: courseIdHex } } }],
      })

      setEditingCourse(false)
      setEditingValues({ name: "", description: "" })
      setEditingErrors({ name: "", description: "" })
      onInvalidate() // Also invalidate parent queries
    } catch (error) {
      console.error("Failed to update course:", error)
    }
  }

  const deleteCourse = async () => {
    if (!confirm("Are you sure you want to delete this course? This action cannot be undone.")) {
      return
    }

    try {
      await deleteCourseMutation.mutateAsync({
        params: { path: { id: courseIdHex } },
      })

      // Invalidate all related queries after deletion
      onInvalidate()
    } catch (error) {
      console.error("Failed to delete course:", error)
    }
  }

  const showVersionForm = () => {
    setShowNewVersionForm(true)
    setNewVersionData({ version: "", description: "" })
  }

  const cancelNewVersion = () => {
    setShowNewVersionForm(false)
    setCreatingErrors({ name: "", description: "" })
    setNewVersionData({ version: "", description: "" })
  }

  const saveNewVersion = async () => {
    if (!newVersionData.version.trim() || !newVersionData.description.trim()) {
      setCreatingErrors({ name: "Version name is required", description: "Description is required" })
      return
    }
    else {
      setCreatingErrors({ name: "", description: "" })
    }

    try {
      await createVersionMutation.mutateAsync({
        params: { path: { id: courseIdHex } },
        body: {
          version: newVersionData.version,
          description: newVersionData.description,
        },
      })

      // Invalidate course query to refresh versions list
      queryClient.invalidateQueries({
        queryKey: ["get", "/courses/{id}", { params: { path: { id: courseIdHex } } }],
      })

      setShowNewVersionForm(false)
      setNewVersionData({ version: "", description: "" })
      onInvalidate() // Also invalidate parent queries
    } catch (error) {
      console.error("Failed to create version:", error)
    }
  }

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <Card
        className={`relative bg-card/95 backdrop-blur-sm border border-border/50 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 ${expandedCourse ? "ring-2 ring-primary/30 shadow-xl shadow-primary/10" : ""
          }`}
      >
        {/* Course Header - Always Visible */}
        <CardHeader
          className="cursor-pointer hover:bg-accent/20 transition-all duration-300 relative overflow-hidden"
          onClick={() => !editingCourse && toggleCourse()}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative md:flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div
                className={`transition-all duration-300 ${expandedCourse ? "rotate-90" : ""}`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleCourse()
                }}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-sm"></div>
                  <div className="relative bg-gradient-to-r from-primary to-accent p-1.5 rounded-full">
                    <ChevronRight className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-lg md:text-xl font-bold text-foreground truncate">
                    {course.name}
                  </CardTitle>
                  <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">
                    <FileText className="h-3 w-3 mr-1" />
                    {course.versions?.length || 0} versions
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Last updated recently</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0 mt-3 md:mt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!expandedCourse) toggleCourse()
                  startEditing()
                }}
                className="h-9 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300"
                disabled={updateCourseMutation.isPending}
              >
                {updateCourseMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Edit3 className="h-3 w-3 mr-1" />
                )}
                Edit
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!expandedCourse) toggleCourse()
                  deleteCourse()
                }}
                className="h-9 bg-background border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-300"
                disabled={deleteCourseMutation.isPending}
              >
                {deleteCourseMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Expanded Content */}
        {expandedCourse && (
          <CardContent className="pt-0 space-y-6">
            <Separator className="bg-border/50" />

            {/* Course Description Section */}
            <div className="space-y-4">
              <h3 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2">
                <div className="w-1 h-5 bg-gradient-to-b from-primary to-accent rounded-full"></div>
                Course Description
              </h3>
              {editingCourse ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-light text-foreground mb-2 block">Course Name</label>
                    <Input
                      value={editingValues.name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditingValues((prev: { name: string; description: string }) => ({
                          ...prev,
                          name: value,
                        }))
                        if (!value.trim()) {
                          setEditingErrors(errors => ({ ...errors, name: "Course name is required." }));
                        } else {
                          setEditingErrors(errors => ({ ...errors, name: '' }));
                        }
                      }}
                      className="border-primary/30 focus:border-primary bg-background"
                      placeholder="Course name"
                    />
                    {editingErrors.name && (
                      <div className="text-xs text-red-500 mt-2">{editingErrors.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-light text-foreground mb-2 block">Description</label>
                    <Textarea
                      value={editingValues.description}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditingValues((prev: { name: string; description: string }) => ({
                          ...prev,
                          description: value,
                        }))
                        // Validation
                        if (!value.trim()) {
                          setEditingErrors(errors => ({ ...errors, description: "Course description is required." }));
                        } else {
                          setEditingErrors(errors => ({ ...errors, description: '' }));
                        }
                      }}
                      className="min-h-[120px] border-primary/30 focus:border-primary bg-background resize-none"
                      placeholder="Course description"
                    />
                    {editingErrors.description && (
                      <div className="text-xs text-red-500 mt-2">{editingErrors.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={saveEditing}
                      size="sm"
                      disabled={updateCourseMutation.isPending}
                      className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                    >
                      {updateCourseMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Save Changes
                    </Button>
                    <Button onClick={cancelEditing} variant="outline" size="sm" className="border-border bg-background">
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-primary/20 rounded-lg blur-sm"></div>
                  <div className="relative bg-accent/10 rounded-lg p-4 border border-accent/30">
                    <p className="text-muted-foreground leading-relaxed">{course.description}</p>
                  </div>
                </div>
              )}
            </div>

            {/* All Versions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-primary to-accent rounded-full"></div>
                  All Versions ({course.versions?.length || 0})
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={showVersionForm}
                    size="sm"
                    variant="outline"
                    disabled={createVersionMutation.isPending}
                    className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 hover:from-primary/20 hover:to-accent/20 transition-all duration-300"
                  >
                    {createVersionMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    New Version
                  </Button>
                </div>
              </div>

              {/* New Version Form */}
              {showNewVersionForm && (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur-sm"></div>
                  <Card className="relative bg-card/95 backdrop-blur-sm border-2 border-primary/30 py-0">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground">Create New Version</h4>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-light text-foreground mb-1 block">Version Name</label>
                          <Input
                            value={newVersionData.version}
                            onChange={(e) => setNewVersionData((prev) => ({ ...prev, version: e.target.value }))}
                            placeholder="e.g., v2.0, Version 2, etc."
                            className="border-primary/30 focus:border-primary bg-background"
                          />
                          {creatingErrors.name && (
                            <div className="text-xs text-red-500 mt-2">{creatingErrors.name}</div>
                          )}
                        </div>

                        <div>
                          <label className="text-sm font-light text-foreground mb-1 block">Version Description</label>
                          <Textarea
                            value={newVersionData.description}
                            onChange={(e) => setNewVersionData((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe what's new in this version..."
                            className="min-h-[80px] border-primary/30 focus:border-primary bg-background resize-none"
                          />
                          {creatingErrors.description && (
                            <div className="text-xs text-red-500 mt-2">{creatingErrors.description}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            onClick={saveNewVersion}
                            size="sm"
                            disabled={createVersionMutation.isPending}
                            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                          >
                            {createVersionMutation.isPending ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            Save Version
                          </Button>
                          <Button onClick={cancelNewVersion} variant="outline" size="sm" className="border-border bg-background">
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Display All Versions */}
              <div className="space-y-3">
                {course.versions && course.versions.length > 0 ? (
                  course.versions.map((versionId: string, index: number) => (
                    <div
                      key={versionId}
                      className="animate-in slide-in-from-left-4 duration-500"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <VersionCard
                        versionId={versionId}
                        courseId={courseIdHex}
                        onInvalidate={onInvalidate}
                        deleteVersionMutation={deleteVersionMutation}
                      />
                    </div>
                  ))
                ) : (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-xl blur-sm"></div>
                    <Card className="relative bg-card/95 backdrop-blur-sm border-dashed border-2 border-muted-foreground/30">
                      <CardContent className="p-6 text-center">
                        <div className="relative inline-block mb-3">
                          <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-full blur-sm"></div>
                          <div className="relative bg-muted/20 border border-muted-foreground/20 rounded-full p-3">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="text-muted-foreground font-medium">No versions available</p>
                        <p className="text-sm text-muted-foreground mt-1">Create your first version to get started</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

// Separate component for individual version cards
function VersionCard({
  versionId,
  courseId,
  onInvalidate,
  deleteVersionMutation,
}: {
  versionId: string
  courseId: string
  onInvalidate: () => void
  deleteVersionMutation: any
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { setCurrentCourse } = useCourseStore()
  const [showProctoringModal, setShowProctoringModal] = useState(false)
  const { setCurrentCourseFlag } = useFlagStore()

  // Fetch individual version data
  const { data: version, isLoading: versionLoading, error: versionError } = useCourseVersionById(versionId)

  const deleteVersion = async () => {
    if (!confirm("Are you sure you want to delete this version? This action cannot be undone.")) {
      return
    }

    try {
      await deleteVersionMutation.mutateAsync({
        params: { path: { courseId: courseId, versionId: versionId } },
      })

      // Invalidate the specific version query
      queryClient.invalidateQueries({
        queryKey: ["get", "/courses/versions/{id}", { params: { path: { id: versionId } } }],
      })

      // Invalidate the course query to refresh versions list
      queryClient.invalidateQueries({
        queryKey: ["get", "/courses/{id}", { params: { path: { id: courseId } } }],
      })

      onInvalidate() // Also invalidate parent queries
    } catch (error) {
      console.error("Failed to delete version:", error)
    }
  }

  const viewEnrollments = () => {
    // Set course info in store and navigate to enrollments page
    setCurrentCourse({
      courseId: courseId,
      versionId: versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    navigate({
      to: "/teacher/courses/enrollments",
    })
  }

  const viewFlags = () => {
    // Set course info in store and navigate to enrollments page
    setCurrentCourseFlag({
      courseId: courseId,
      versionId: versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    navigate({
      to: "/teacher/courses/flags/list",
    })
  }
  const sendInvites = () => {
    // Set course info in store and navigate to invite page
    setCurrentCourse({
      courseId: courseId,
      versionId: versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    navigate({
      to: "/teacher/courses/invite",
    })
  }

  const viewCourse = () => {
    // Set course info in store and navigate to course content
    setCurrentCourse({
      courseId: courseId,
      versionId: versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    navigate({
      to: "/teacher/courses/view",
    })
  }

  if (versionLoading) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-muted/10 to-muted/5 rounded-xl blur-sm"></div>
        <Card className="relative bg-card/95 backdrop-blur-sm border-l-4 border-l-muted">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-full blur-sm animate-pulse"></div>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground relative z-10" />
              </div>
              <span className="text-sm text-muted-foreground">Loading version...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Hide the version card if there's an error or no version data
  if (versionError || !version) {
    return null
  }

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <Card className="relative bg-card/95 backdrop-blur-sm border-l-4 border-l-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
        <CardContent className="p-4">
          <div className="lg:flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold text-foreground">{version.version}</h4>
                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-xs">
                  Version
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{version.description}</p>
            </div>

            <div className="flex items-center flex-wrap gap-2 shrink-0 mt-2 lg:mt-0">
              <Button variant="outline" size="sm" onClick={viewFlags} className="h-7 text-xs cursor-pointer">
                <FlagTriangleRight className="h-3 w-3 mr-1" />
                View Flags
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={viewEnrollments}
                className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
              >
                <Users className="h-3 w-3 mr-1" />
                View Enrollments
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={sendInvites}
                className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
              >
                <Users className="h-3 w-3 mr-1" />
                Send Invites
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={viewCourse}
                className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deleteVersion}
                className="h-8 bg-background border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-300 text-xs"
                disabled={deleteVersionMutation.isPending}
              >
                {deleteVersionMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProctoringModal(true)
                }}
                className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300"
              >
                <FileText className="h-3 w-3 mr-1" />
                Settings
              </Button>
            </div>
          </div>

          <ProctoringModal
            open={showProctoringModal}
            onClose={() => setShowProctoringModal(false)}
            courseId={courseId}
            courseVersionId={versionId}
            isNew={false}
          />

        </CardContent>
      </Card>
    </div>
  )
}