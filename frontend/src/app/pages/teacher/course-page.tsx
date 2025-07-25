"use client"

import { useState, useEffect } from "react"
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
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ProctoringModal } from "@/components/EditProctoringModal"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Checkbox } from "@/components/ui/checkbox"
import { Pagination } from "@/components/ui/Pagination"

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
  const filteredEnrollements = enrollments.filter((enrollment)=>enrollment.role !== "STUDENT");

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
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading courses...</span>
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
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load courses</h3>
            <p className="text-muted-foreground mb-4">{enrollmentsError}</p>
            <Button onClick={() => refetch()}>Try Again</Button>
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
            <div className="mb-4">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No courses found</h3>
            <p className="text-muted-foreground mb-4">Create your first course to get started</p>
            <Button onClick={createNewCourse}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Course
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Courses</h1>
            <p className="text-muted-foreground mt-1">Manage your courses and versions</p>
          </div>
          <Button onClick={createNewCourse} className="h-10">
            <Plus className="h-4 w-4 mr-2" />
            Create New Course
          </Button>
        </div>

        {/* Search Section */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Courses List */}
        <div className="space-y-4">
          {filteredCourses.map((enrollment: any) => (
            <CourseCard
              key={enrollment._id}
              enrollment={enrollment}
              searchQuery={searchQuery}
              onInvalidate={invalidateAllQueries}
            />
          ))}
        </div>

        {/* Pagination */}
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

  const queryClient = useQueryClient()

  // Convert buffers to hex strings for API compatibility
  const courseIdHex = bufferToHex(enrollment.courseId)

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
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading course...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (courseError || !course) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p>Error loading course data</p>
          </div>
        </CardContent>
      </Card>
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
  }

  const saveEditing = async () => {
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
    setNewVersionData({ version: "", description: "" })
  }

  const saveNewVersion = async () => {
    if (!newVersionData.version.trim() || !newVersionData.description.trim()) {
      alert("Please fill in both version name and description")
      return
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
    <Card
      className={`transition-all duration-300 hover:shadow-lg ${expandedCourse ? "ring-2 ring-primary/20 shadow-lg" : ""
        }`}
    >
      {/* Course Header - Always Visible */}
      <CardHeader
        className="cursor-pointer hover:bg-accent/30 transition-colors duration-200"
        onClick={() => !editingCourse && toggleCourse()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              className={`transition-transform duration-200 ${expandedCourse ? "rotate-90" : ""}`}
              onClick={(e) => {
                e.stopPropagation()
                toggleCourse()
              }}
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-xl font-bold text-foreground truncate">{course.name}</CardTitle>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>{course.versions?.length || 0} versions</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                if (!expandedCourse) toggleCourse()
                startEditing()
              }}
              className="h-8 cursor-pointer"
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
              className="h-8 text-destructive hover:text-destructive cursor-pointer"
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
          <Separator />

          {/* Course Description Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Course Description</h3>
            {editingCourse ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Course Name</label>
                  <Input
                    value={editingValues.name}
                    onChange={(e) =>
                      setEditingValues((prev: { name: string; description: string }) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="border-primary/30 focus:border-primary"
                    placeholder="Course name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Description</label>
                  <Textarea
                    value={editingValues.description}
                    onChange={(e) =>
                      setEditingValues((prev: { name: string; description: string }) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="min-h-[120px] border-primary/30 focus:border-primary resize-none"
                    placeholder="Course description"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={saveEditing}
                    size="sm"
                    disabled={updateCourseMutation.isPending}
                    className="cursor-pointer"
                  >
                    {updateCourseMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    Save Changes
                  </Button>
                  <Button onClick={cancelEditing} variant="outline" size="sm" className="cursor-pointer">
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-accent/20 rounded-lg p-4 border border-accent/30">
                <p className="text-muted-foreground leading-relaxed">{course.description}</p>
              </div>
            )}
          </div>

          {/* All Versions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">All Versions ({course.versions?.length || 0})</h3>
              <div className="flex items-center gap-2">
                <Button
                  onClick={showVersionForm}
                  size="sm"
                  variant="outline"
                  disabled={createVersionMutation.isPending}
                  className="cursor-pointer"
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
              <Card className="bg-accent/10 border-2 border-primary/30">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground">Create New Version</h4>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Version Name</label>
                      <Input
                        value={newVersionData.version}
                        onChange={(e) => setNewVersionData((prev) => ({ ...prev, version: e.target.value }))}
                        placeholder="e.g., v2.0, Version 2, etc."
                        className="border-primary/30 focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Version Description</label>
                      <Textarea
                        value={newVersionData.description}
                        onChange={(e) => setNewVersionData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe what's new in this version..."
                        className="min-h-[80px] border-primary/30 focus:border-primary resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        onClick={saveNewVersion}
                        size="sm"
                        disabled={createVersionMutation.isPending}
                        className="cursor-pointer"
                      >
                        {createVersionMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3 mr-1" />
                        )}
                        Save Version
                      </Button>
                      <Button onClick={cancelNewVersion} variant="outline" size="sm" className="cursor-pointer">
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Display All Versions */}
            <div className="space-y-3">
              {course.versions && course.versions.length > 0 ? (
                course.versions.map((versionId: string) => (
                  <VersionCard
                    key={versionId}
                    versionId={versionId}
                    courseId={courseIdHex}
                    onInvalidate={onInvalidate}
                    deleteVersionMutation={deleteVersionMutation}
                  />
                ))
              ) : (
                <Card className="bg-muted/20 border-dashed border-2">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No versions available</p>
                    <p className="text-sm text-muted-foreground mt-1">Create your first version to get started</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
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
      <Card className="bg-card/50 border-l-4 border-l-muted">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading version...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Hide the version card if there's an error or no version data
  if (versionError || !version) {
    return null
  }

  return (
    <Card className="bg-card/50 border-l-4 border-l-primary/40 hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <h4 className="font-semibold text-foreground">{version.version}</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{version.description}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={viewEnrollments} className="h-7 text-xs cursor-pointer">
              <Users className="h-3 w-3 mr-1" />
              View Enrollments
            </Button>
            <Button variant="outline" size="sm" onClick={sendInvites} className="h-7 text-xs cursor-pointer">
              <Users className="h-3 w-3 mr-1" />
              Send Invites
            </Button>
            <Button variant="outline" size="sm" onClick={viewCourse} className="h-7 text-xs cursor-pointer">
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteVersion}
              className="h-7 text-xs text-destructive hover:text-destructive cursor-pointer"
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
              className="h-8"
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
  )
}