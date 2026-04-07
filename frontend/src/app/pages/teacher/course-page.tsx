"use client"
import { useState, useEffect, lazy, ChangeEvent } from "react"
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
  UserCog2,
  Sparkles,
  GraduationCap,
  BookOpenIcon,
  Settings2,
  MailPlus,
  Clock,
  BarChart3,
  RotateCcw,
  FlagTriangleRight,
  Copy,
  UserCheck,
  Headphones,
  ExternalLink,
  Megaphone,
  CheckCheckIcon,
  Archive,
  ArchiveRestore,
  Layers,
  Shield,
  Activity,
  MoreVertical,
  MoreVerticalIcon,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ProctoringModal } from "@/components/EditProctoringModal"
import { Pagination } from "@/components/ui/Pagination"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Import the hooks and auth store
import {
  useUpdateCourse,
  useDeleteCourse,
  useCreateCourseVersion,
  useDeleteCourseVersion,
  useUpdateCourseVersion,
  useCourseVersionArchive,
  useUserEnrollments,
  useCourseById,
  useCourseVersionById,
  useGenerateLink,
  useCopyCourseVersion
} from "@/hooks/hooks"
import { useAuthStore } from "@/store/auth-store"
import { useCourseStore } from "@/store/course-store"
import { useFlagStore } from "@/store/flag-store"
import { bufferToHex } from "@/utils/helpers"

// Define types for better TypeScript support
import type { RawEnrollment } from "@/types/course.types"
import { components } from "@/types/schema"
import { useAnomalyStore } from "@/store/anomaly-store"
import { ProjectSubmissionsDownloadButton } from "./components/ProjectSubmissionsDownloadButton"
import { toast } from "sonner"
import ConfirmationModal from "./components/confirmation-modal"
import { AnnouncementModal } from "@/components/announcements/AnnouncementModal"
import { AnnouncementType } from "@/types/announcement.types"
import { useAnnouncements } from "@/hooks/announcement-hooks"

// Utility function to format relative time
const getUpdateMessage = (updatedAt?: string) => {
  if (!updatedAt) return "No updates yet";

  const updatedDate = new Date(updatedAt);
  const now = new Date();
  const diffMs = +now - +updatedDate;

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 5) return "A few minutes ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return "An hour ago";
  if (diffHours < 6) return `${diffHours} hours ago`;
  if (diffHours < 24) return "Earlier today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return "Last week";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return "Last month";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  if (diffYears === 1) return "Last year";

  return `${diffYears} years ago`;
};

export default function TeacherCoursesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [initialDocumentCount, setInitialDocumentCount] = useState(0);
  const [lastEmptyState, setLastEmptyState] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => {
    const stored = sessionStorage.getItem("teacher_page")
    return stored ? Number(stored) : 1
  })
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const { isAdmin } = useAnnouncements();
  const queryClient = useQueryClient()

  const role = "INSTRUCTOR"
  // Fetch user enrollments with pagination (use reasonable page size)
  const { token } = useAuthStore()
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const {
    data: enrollmentsResponse,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
    refetch,
  } = useUserEnrollments(currentPage, 10, !!token, debouncedSearchQuery, role, tab) // Use pagination with 10 items per page
  const enrollments = enrollmentsResponse?.enrollments || []

  const totalPages = enrollmentsResponse?.totalPages || 1
  const totalDocuments = enrollmentsResponse?.totalDocuments || 0
  const activeCount = enrollmentsResponse?.activeCount || 0
  const archivedCount = enrollmentsResponse?.archivedCount || 0

  // Get unique courses (in case user is enrolled in multiple versions of same course)
  // Since we're using pagination, we'll work with the current page data
  const uniqueCourses = enrollments.reduce((acc: any[], enrollment: any) => {
    const courseIdHex = bufferToHex(enrollment.courseId)
    const existingCourse = acc.find((e) => bufferToHex(e.courseId) === courseIdHex)
    if (!existingCourse) {
      acc.push(enrollment)
    }
    return acc
  }, [])

  const handleSearchQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    if (value && enrollments.length === 0) {
      setLastEmptyState(value);
    } else if (value === "") {
      setLastEmptyState(null);
    }
  }


  const navigate = useNavigate()
  const createNewCourse = () => {
    navigate({ to: "/teacher/courses/create" })
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  useEffect(() => {
    if (enrollmentsResponse !== undefined && initialDocumentCount === 0) {
      setInitialDocumentCount(totalDocuments)
    }
  }, [totalDocuments, initialDocumentCount, enrollmentsResponse])

  useEffect(() => {
    sessionStorage.removeItem("teacher_page")
  }, [])

  // Reset page to 1 when search query changes
  useEffect(() => {
    if (searchQuery) {
      setCurrentPage(1)
    }
  }, [searchQuery])

  useEffect(() => {
    if (initialDocumentCount === 0 && !searchQuery) {
      return;
    }
    if (!searchQuery.trim()) {
      setDebouncedSearchQuery("");
      return;
    }
    if (lastEmptyState && searchQuery.startsWith(lastEmptyState) && searchQuery.length >= lastEmptyState.length) {
      return;
    }
    const timerId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 400)

    return () => clearTimeout(timerId)
  }, [searchQuery, initialDocumentCount, lastEmptyState])

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
  if (activeCount === 0 && archivedCount === 0 && !enrollmentsLoading) {
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
    <div className="flex-1 md:p-6 p-3 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto space-y-8 min-w-0">
        {/* Header Section with Beautiful Design */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>
          <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl md:p-8 p-4">
            <div className="lg:flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg "></div>
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
              <div className="flex flex-col lg:flex-row gap-3 mt-4 lg:mt-0">
                {isAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => setShowAnnouncementModal(true)}
                    className="bg-background/50 hover:bg-background/80 border-primary/20 hover:border-primary/50 text-foreground h-12 px-6"
                  >
                    <Megaphone className="h-4 w-4 mr-2 text-primary" />
                    General Announcements
                  </Button>
                )}
                <Button
                  onClick={createNewCourse}
                  className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 h-12 px-8 group"
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
            <AnnouncementModal
              isOpen={showAnnouncementModal}
              onClose={() => setShowAnnouncementModal(false)}
              defaultType={AnnouncementType.GENERAL}
              isAdmin={isAdmin}
            />
          </div>
        </div>

        {/* Search Section with Enhanced Design */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-xl blur-sm"></div>
          <div className="relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-4">
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v as 'active' | 'archived')
                setCurrentPage(1)
              }}
              className="w-full"
            >
              <TabsList className="grid w-full sm:w-[420px] grid-cols-2 h-11 bg-muted/40 backdrop-blur-sm border border-border/50 p-1 rounded-xl overflow-hidden mb-4">
                <TabsTrigger
                  value="active"
                  className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200
                data-[state=active]:bg-background/80
                data-[state=active]:text-foreground
                data-[state=active]:shadow-sm"
                >
                  Active Versions({activeCount})
                </TabsTrigger>

                <TabsTrigger
                  value="archived"
                  className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200
                data-[state=active]:bg-background/80
                data-[state=active]:text-foreground
                data-[state=active]:shadow-sm"
                >
                  Archived Versions({archivedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="md:flex flex-row items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg "></div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    disabled={initialDocumentCount === 0}
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={handleSearchQueryChange}
                    className="pl-10 bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300"
                  />
                </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground">
                  <X className="h-4 w-4 cursor-pointer" onClick={() => setSearchQuery('')} />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground md:mt-0 mt-3">
                <BarChart3 className="h-4 w-4" />
                <span>{uniqueCourses.length} courses</span>
              </div>
            </div>
          </div>
        </div>

        {/* Courses List with Beautiful Cards */}
        <div className="space-y-6">
          {
            enrollmentsLoading ?
              <div className="flex items-center justify-center md:mt-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2  text-muted-foreground">
                  Loading courses...
                </span>
              </div> :
              uniqueCourses.length === 0 && !enrollmentsLoading ? (
                <div className="flex items-center justify-center text-muted-foreground">
                  No {tab} courses found.
                </div>
              ) :
                filteredCourses.map((enrollment: any, index: number) => (
                  <div
                    key={enrollment._id}
                    className="animate-in slide-in-from-bottom-4 duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CourseCard
                      enrollment={enrollment}
                      onInvalidate={invalidateAllQueries}
                      currentPage={currentPage}
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
  onInvalidate,
  currentPage,
}: {
  enrollment: RawEnrollment
  onInvalidate: () => void
  currentPage: number
}) {
  const [showNewVersionForm, setShowNewVersionForm] = useState(false)
  const [newVersionData, setNewVersionData] = useState({ version: "", description: "" })
  const [expandedCourse, setExpandedCourse] = useState(false)
  const [editingCourse, setEditingCourse] = useState(false)
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [editingValues, setEditingValues] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  })
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [expandedDescription, setExpandedDescription] = useState(false)

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


  // 1. Use course from enrollment if available
  const localCourse = enrollment?.course;
  const localCourseVersionDetails = enrollment?.course?.versionDetails;
  // 2. Fetch from API only if not present in enrollment
  const { data: fetchedCourse, isLoading: courseLoading, error: courseError } = useCourseById(courseIdHex,
    !localCourse ? true : false
  );

  // 3. Choose final course value
  const course = localCourse || fetchedCourse;

  // determine whether the enrollment corresponds to an archived version
  const enrollmentVersionStatus = enrollment.course?.versionDetails?.find((v: any) =>
    v.id === bufferToHex(enrollment.courseVersionId as any)
  )?.versionStatus;
  const isArchivedEnrollment = enrollmentVersionStatus === 'archived';


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
    try {
      await deleteCourseMutation.mutateAsync({
        params: { path: { id: courseIdHex } },
      })

      // Invalidate all related queries after deletion
      onInvalidate()
    } catch (error) {
      console.error("Failed to delete course:", error)
    } finally {
      setShowDeleteCourseModal(false);
    }
  }
  //version validation
  const versionErrors = {
    name: !newVersionData.version.trim() ? "Version name is required"
      : newVersionData.version.trim().length < 3 ? "Version name must be at least 3 characters"
        : newVersionData.version.trim().length > 255 ? "Version name must be at most 255 characters"
          : "",
    description: !newVersionData.description.trim() ? "Description is required"
      : newVersionData.description.trim().length > 1000 ? "Description must be less than 1000 characters"
        : "",
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
    if (!newVersionData.version.trim() || !newVersionData.description.trim() || newVersionData.version.trim().length < 3 || newVersionData.version.trim().length > 255) {
      setCreatingErrors(versionErrors)
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
    } catch (err: any) {
      let errorMsg = "Failed to create version";

      // Extract error message from the error object
      if (err?.errors?.length > 0) {
        errorMsg = (Object.values(err.errors[0].constraints || {})[0] as string);
      } else if (err.message) {
        errorMsg = err.message;
      }

      toast.error(errorMsg, {
        position: 'top-right',
        duration: 5000,
      });
    }
  }

  const navigate = useNavigate()

  const handleAuditClick = () => {
    // Navigate to the audit page for this course
    localStorage.setItem("selectedCourseId", courseIdHex)
    localStorage.setItem("selectedCourseVersionId", bufferToHex(enrollment.courseVersionId as any))
    localStorage.setItem("selectedCourseVersions", JSON.stringify(course.versions || []))
    navigate({ to: `/teacher/audit` })

  }

  const MAX_DESCRIPTION_LENGTH = 1000;

  if (enrollment.policyReacknowledgementRequired) {
    // Show a banner or disable "Continue" button
    return (
      <div className="...warning banner...">
        Policy updated — please re-acknowledge via the notification bell to continue.
      </div>
    );
  }
  const MAX_DESC_LENGTH = 80;

  const isLongDescription = course.description?.length > MAX_DESC_LENGTH;

  const displayedDescription = expandedDescription
    ? course.description
    : course.description?.slice(0, MAX_DESC_LENGTH);

  return (
    <div className="relative group">
      {/* <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div> */}
      <Card
        className={`relative bg-card/95 backdrop-blur-sm border border-border/50 overflow-hidden transition-all duration-500  min-w-0 hover:bg-accent/5 ${expandedCourse ? "" : ""
          }`}
      >
        {/* Course Header - Always Visible */}
        <CardHeader className="relative  overflow-hidden">
          <div className="absolute inset-0  opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
          <div>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div
                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                onClick={() => !editingCourse && toggleCourse()}
              >
                <div className={`transition-all duration-300 ${expandedCourse ? "rotate-90" : ""}`}>
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-sm"></div>
                    <div className="relative bg-gradient-to-r from-primary to-accent p-1.5 rounded-full">
                      <ChevronRight className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {/* <div className="flex flex-row sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2"> */}
                  <div className="flex flex-row items-center gap-2 sm:gap-3 mb-2">
                    <CardTitle className="text-lg md:text-xl font-bold text-foreground sm:line-clamp-2 break-words">
                      {(() => {
                        const MAX_TITLE_LENGTH = 100;
                        const isLong = course.name.length > MAX_TITLE_LENGTH;
                        const displayName = isLong ? course.name.slice(0, MAX_TITLE_LENGTH) + "..." : course.name;
                        return (
                          <span
                            className="relative cursor-pointer"
                            title={isLong ? course.name : undefined}
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "100%",
                              display: "inline-block"
                            }}
                          >
                            {displayName}
                            {isLong && (
                              <span className="absolute left-0 top-full z-10 mt-1 px-2 py-1 bg-background border border-border rounded shadow text-xs text-foreground whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                {course.name}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </CardTitle>
                    {/* <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary w-fit shrink-0">
                      <FileText className="h-3 w-3 mr-1" />
                      {`${course.versions?.length || 0} version${course.versions?.length > 1 ? 's' : ''}`}
                    </Badge> */}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {/* <span>Last updated {course.updatedAt? `${formatDateTime(course.updatedAt,true)}` :"recently"}</span> */}
                      <span>Last updated {getUpdateMessage(course.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* <div className="flex items-center justify-end gap-2 shrink-0 mt-3 md:mt-0">
                <Button variant="outline" size="sm" onClick={handleAuditClick}>
                  <CheckCheckIcon />  View Audit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!expandedCourse) toggleCourse()
                    startEditing()
                  }}
                  className="h-9 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300"
                  disabled={updateCourseMutation.isPending || isArchivedEnrollment}
                  title={isArchivedEnrollment ? "Cannot edit archived course" : undefined}
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
                    setShowAnnouncementModal(true)
                  }}
                  className="h-9 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300"
                  disabled={isArchivedEnrollment}
                  title={isArchivedEnrollment ? "Cannot announce on archived course" : undefined}
                >
                  <Megaphone className="h-3 w-3 mr-1" />
                  Announce
                </Button>
              </div> */}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    setShowAnnouncementModal(true)
                  }}
                    disabled={isArchivedEnrollment}
                    title={isArchivedEnrollment ? "Cannot announce on archived course" : undefined}
                  >
                    <Megaphone className="h-4 w-4 mr-2" />
                    Announce
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    if (!expandedCourse) toggleCourse()
                    startEditing()
                  }}
                    disabled={updateCourseMutation.isPending || isArchivedEnrollment}
                    title={isArchivedEnrollment ? "Cannot edit archived course" : undefined}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleAuditClick}>
                    <CheckCheckIcon className="h-4 w-4 mr-2" />
                    View Audit
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={showVersionForm} disabled={createVersionMutation.isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Version
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!expandedCourse) toggleCourse()
                      setShowDeleteCourseModal(true)
                    }}
                    disabled={deleteCourseMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Course
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <div className="relative group">
          <ConfirmationModal
            isOpen={showDeleteCourseModal}
            onClose={() => setShowDeleteCourseModal(false)}
            onConfirm={deleteCourse}
            title="Delete Course"
            description="This will delete the entire course, including all modules and sections."
            confirmText="Delete"
            cancelText="Cancel"
            isDestructive={true}
            isLoading={deleteCourseMutation.isPending}
            loadingText="Deleting..."
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <AnnouncementModal
            isOpen={showAnnouncementModal}
            onClose={() => setShowAnnouncementModal(false)}
            defaultType={AnnouncementType.COURSE_SPECIFIC}
            courseId={courseIdHex}
          />
        </div>

        {/* Expanded Content */}
        {expandedCourse && (
          <CardContent className="">
            <div className="rounded-xl pt-0 space-y-6">

              <Separator className="bg-border/50" />

              {/* Course Description Section */}
              {(editingCourse || course?.description) && (
                <div className="space-y-4">
                  <h3 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-primary to-accent rounded-full"></div>
                    Course Description
                  </h3>
                  {editingCourse ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-light text-foreground mb-2 block">Course Name *</label>
                        <Input
                          value={editingValues.name}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditingValues((prev: { name: string; description: string }) => ({
                              ...prev,
                              name: value,
                            }));
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
                        <label className="text-sm font-light text-foreground mb-2 block">Description *</label>
                        <Textarea
                          value={editingValues.description}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.length <= MAX_DESCRIPTION_LENGTH) {
                              setEditingValues((prev: { name: string; description: string }) => ({
                                ...prev,
                                description: value,
                              }));
                            }
                            // Validation
                            if (!value.trim()) {
                              setEditingErrors(errors => ({ ...errors, description: "Course description is required." }));
                            } else if (value.length >= MAX_DESCRIPTION_LENGTH) {
                              setEditingErrors(errors => ({ ...errors, description: `Description must be less than ${MAX_DESCRIPTION_LENGTH} characters` }));
                            } else {
                              setEditingErrors(errors => ({ ...errors, description: '' }));
                            }
                          }}
                          className="min-h-[120px] border-primary/30 focus:border-primary bg-background resize-none"
                          placeholder="Course description"
                        />
                        <div className="flex justify-between items-center mt-1">
                          <div className="text-xs text-muted-foreground">
                            {editingValues.description.length >= MAX_DESCRIPTION_LENGTH * 0.9 && (
                              <span className="text-destructive">
                                Description must be less than {MAX_DESCRIPTION_LENGTH} characters
                              </span>
                            )}
                            {editingErrors.description && (
                              <span className="text-destructive">{editingErrors.description}</span>
                            )}
                          </div>
                          <div className={`text-xs ${editingValues.description.length >= MAX_DESCRIPTION_LENGTH * 0.9
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                            }`}>
                            {editingValues.description.length}/{MAX_DESCRIPTION_LENGTH}
                          </div>
                        </div>
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
                      <div className="absolute inset-0  rounded-lg "></div>
                      <div className="relative bg-accent/1 rounded-lg p-4 border border-accent/10">
                        <div className="relative bg-accent/1 rounded-lg p-4 border border-accent/10">
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                            {displayedDescription}
                            {!expandedDescription && isLongDescription && "..."}
                            {isLongDescription && (
                              <span
                                onClick={() => setExpandedDescription(!expandedDescription)}
                                className="text-primary cursor-pointer hover:underline text-xs"
                              >
                                {expandedDescription ? " View Less" : "View More"}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* All Versions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-primary to-accent rounded-full"></div>
                    All Versions ({course.versions?.length || 0})
                  </h3>
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
                  {localCourseVersionDetails && localCourseVersionDetails.length > 0 ? (
                    localCourseVersionDetails.map((versionData, index: number) => (
                      <div
                        key={versionData.id}
                        className="animate-in slide-in-from-left-4 duration-500"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <VersionCard
                          versionData={versionData}
                          courseId={courseIdHex}
                          onInvalidate={onInvalidate}
                          deleteVersionMutation={deleteVersionMutation}
                          versionCount={course?.versions?.length}
                          currentPage={currentPage}
                          showVersionForm={showVersionForm}
                          createVersionMutation={createVersionMutation}
                          expandedCourse={expandedCourse}
                          toggleCourse={toggleCourse}
                          setShowDeleteCourseModal={setShowDeleteCourseModal}
                          deleteCourseMutation={deleteCourseMutation}
                        />
                      </div>
                    ))
                  ) : course.versions && course.versions.length > 0 ? (
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
                          versionCount={course?.versions?.length}
                          currentPage={currentPage}
                          showVersionForm={showVersionForm}
                          createVersionMutation={createVersionMutation}
                          expandedCourse={expandedCourse}
                          toggleCourse={toggleCourse}
                          setShowDeleteCourseModal={setShowDeleteCourseModal}
                          deleteCourseMutation={deleteCourseMutation}
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

            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

// Separate component for individual version cards
function VersionCard({
  versionData,
  versionId = "",
  courseId,
  onInvalidate,
  deleteVersionMutation,
  versionCount,
  currentPage,
  showVersionForm,
  createVersionMutation,
  expandedCourse,
  toggleCourse,
  setShowDeleteCourseModal,
  deleteCourseMutation

}: {
  versionData?: components['schemas']['CourseVersionDataResponse'];
  versionId?: string
  courseId: string
  onInvalidate: () => void
  deleteVersionMutation: any
  versionCount: number
  currentPage: number
  showVersionForm: () => void
  createVersionMutation: any
  expandedCourse: boolean
  toggleCourse: () => void
  setShowDeleteCourseModal: (a: boolean) => void
  deleteCourseMutation: any
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const storePageAndNavigate = (path: string) => {
    sessionStorage.setItem("teacher_page", String(currentPage))

    navigate({
      to: path as any,
    })
  }
  const { setCurrentCourse } = useCourseStore()
  const [showProctoringModal, setShowProctoringModal] = useState(false)
  const { setCurrentCourseFlag } = useFlagStore()
  const { setCurrentAnomaly } = useAnomalyStore();
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  // Edit state variables 
  const [editingVersion, setEditingVersion] = useState(false)
  const [editingValues, setEditingValues] = useState<{ version: string; description: string; supportLink: string }>({
    version: "",
    description: "",
    supportLink: "",
  })
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [editingErrors, setEditingErrors] = useState<{ version?: string; description?: string; supportLink?: string }>({})

  // Add update version hook
  const updateVersionMutation = useUpdateCourseVersion()

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showDeleteVersionModel, setShowDeleteVersionModel] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const generateLinkMutation = useGenerateLink();
  // To copy a entire course version
  const { mutateAsync: copyEntireCourseVersion, isPending: copyVersionIsPending } = useCopyCourseVersion()

  // Fetch individual version data
  const { data: fetchedVersion, isLoading: versionLoading, error: versionError } = useCourseVersionById(versionId, !versionData ? true : false)

  const version = versionData || fetchedVersion;


  const selectedVersionId = version?.id || versionId;
  const isArchived = (version as any)?.versionStatus === 'archived';
  const { mutateAsync: archiveMutateAsync, isPending: isArchivePending } = useCourseVersionArchive();
  // const [cohorts, setCohorts] = useState<string[]>([]);
  const [cohortInput, setCohortInput] = useState("");
  const [existingCohorts, setExistingCohorts] = useState<[]>([])
  const [newCohorts, setNewCohorts] = useState<string[]>([])
  useEffect(() => {
    if (fetchedVersion?.cohortDetails) {
      setExistingCohorts(fetchedVersion.cohortDetails);
    }
  }, [fetchedVersion]);
  const MAX_COHORTS = 10;
  const addCohort = (value: string) => {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return
    if (
      existingCohorts.includes(trimmed) ||
      newCohorts.includes(trimmed)
    ) return
    if (existingCohorts.length + newCohorts.length >= MAX_COHORTS) return
    setNewCohorts(prev => [...prev, trimmed])
    setCohortInput("")
  }
  const removeNewCohort = (cohort: string) => {
    setNewCohorts(prev => prev.filter(c => c !== cohort))
  }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCohort(cohortInput);
    }
  };
  const handleArchive = async () => {
    try {
      await archiveMutateAsync({
        params: {
          path: {
            courseId: courseId,
            versionId: selectedVersionId,
          },
        },
        body: {
          versionStatus: isArchived ? 'active' : 'archived',
        },
      } as any);

      toast.success(isArchived ? 'Version unarchived successfully' : 'Version archived successfully');
      onInvalidate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update version status');
    }
  };

  if (!version) return null;

  const startEditingVersion = () => {
    setEditingVersion(true)
    setEditingValues({
      version: version?.version || "",
      description: version?.description || "",
      supportLink: (version as any)?.supportLink || "",
    })
  }

  const cancelEditingVersion = () => {
    setEditingVersion(false)
    setEditingValues({ version: "", description: "", supportLink: "" })
    setEditingErrors({ version: "", description: "", supportLink: "" })
  }
  //version validation
  const versionErrors = {
    version: !editingValues.version.trim() ? "Version name is required"
      : editingValues.version.trim().length < 3 ? "Version name must be at least 3 characters"
        : editingValues.version.trim().length > 255 ? "Version name must be at most 255 characters"
          : "",
    description: !editingValues.description.trim() ? "Description is required"
      : editingValues.description.trim().length > 1000 ? "Description must be less than 1000 characters"
        : "",

  }
  const saveEditingVersion = async () => {
    if (!editingValues.version.trim() || !editingValues.description.trim() || editingValues.version.trim().length < 3 || editingValues.version.trim().length > 255 || editingValues.description.trim().length > 1000) {
      setEditingErrors(versionErrors)
      return
    }

    const supportLinkValue = editingValues.supportLink.trim();
    if (supportLinkValue) {
      const isEmail = supportLinkValue.includes('@');
      const isUrl = /^https?:\/\/.+/.test(supportLinkValue);
      if (!isEmail && !isUrl) {

        setEditingErrors({ supportLink: "Must be a valid URL (https://...) or email address" })
        return
      }
    }

    setEditingErrors({ version: "", description: "", supportLink: "" })

    try {
      await updateVersionMutation.mutateAsync({
        params: { path: { courseId: courseId, versionId: selectedVersionId } },
        body: {
          version: editingValues.version,
          description: editingValues.description,
          supportLink: supportLinkValue || "",
          cohorts: [...newCohorts],
        } as any,
      })

      queryClient.invalidateQueries({
        queryKey: ["get", "/courses/versions/{id}"],
      })
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.some((key) => String(key).includes(selectedVersionId))
      })

      setEditingVersion(false)
      setEditingValues({ version: "", description: "", supportLink: "" })
      setEditingErrors({ version: "", description: "", supportLink: "" })
      setNewCohorts([]);
      onInvalidate()
    } catch (err: any) {
      let errorMsg = "Failed to update version";

      // Extract error message from the error object
      if (err?.errors?.length > 0) {
        errorMsg = (Object.values(err.errors[0].constraints || {})[0] as string);
      } else if (err.message) {
        errorMsg = err.message;
      }

      toast.error(errorMsg, {
        position: 'top-right',
        duration: 5000,
      });
    }
  }

  const deleteVersion = async () => {
    try {
      await deleteVersionMutation.mutateAsync({
        params: { path: { courseId: courseId, versionId: selectedVersionId } },
      })

      // Invalidate the specific version query
      queryClient.invalidateQueries({
        queryKey: ["get", "/courses/versions/{id}", { params: { path: { id: selectedVersionId } } }],
      })

      // Invalidate the course query to refresh versions list
      queryClient.invalidateQueries({
        queryKey: ["get", "/courses/{id}", { params: { path: { id: courseId } } }],
      })

      onInvalidate() // Also invalidate parent queries
    } catch (error) {
      console.error("Failed to delete version:", error)
      // Show error toast to user
      toast.error("Failed to delete version. Please try again.");
    }
  }

  const viewEnrollments = () => {
    // Set course info in store and navigate to enrollments page
    setCurrentCourse({
      courseId: courseId,
      versionId: selectedVersionId ? selectedVersionId : null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    storePageAndNavigate("/teacher/courses/enrollments")
  }

  const goToRegistrations = () => {
    setCurrentCourse({
      courseId: courseId,
      versionId: selectedVersionId ? selectedVersionId : null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    storePageAndNavigate("/teacher/courses/registration-requests")
  }

  const viewInstructors = () => {
    // Set course info in store and navigate to instructors page
    setCurrentCourse({
      courseId: courseId,
      versionId: selectedVersionId ? selectedVersionId : null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    storePageAndNavigate("/teacher/courses/instructors")
  }

  const viewFlags = () => {
    // Set course info in store and navigate to enrollments page
    setCurrentCourseFlag({
      courseId: courseId,
      versionId: selectedVersionId ? selectedVersionId : null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    storePageAndNavigate("/teacher/courses/flags/list")
  }
  const viewAnomalies = () => {
    setCurrentAnomaly({
      courseId: courseId,
      versionId: selectedVersionId ? selectedVersionId : null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null
    });
    storePageAndNavigate("/teacher/courses/anomalies/list")
  }
  const sendInvites = () => {
    // Set course info in store and navigate to invite page
    setCurrentCourse({
      courseId: courseId,
      versionId: selectedVersionId ? selectedVersionId : null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    storePageAndNavigate("/teacher/courses/invite")
  }

  const configureCohorts = () => {
    // Set course info in store and navigate to invite page
    setCurrentCourse({
      courseId: courseId,
      versionId: selectedVersionId ? selectedVersionId : null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    storePageAndNavigate("/teacher/courses/cohorts")
  }

  const viewCourse = () => {
    // Set course info in store and navigate to course content
    setCurrentCourse({
      courseId: courseId,
      versionId: selectedVersionId ? selectedVersionId : null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })
    storePageAndNavigate("/teacher/courses/view")
  }

  const handleGenerateLink = async () => {
    try {
      const result = await generateLinkMutation.mutateAsync({
        params: { path: { courseId: courseId, versionId: selectedVersionId } },
      });
      setGeneratedLink(result.link);
      setShowLinkModal(true);
      toast.success('Link generated successfully!');
    } catch (error) {
      console.error('Failed to generate link:', error);
      toast.error('Failed to generate link. Please try again.');
    }
  };
  const handleCopy = async () => {
    try {
      if (!courseId || !selectedVersionId) {
        toast.error('Failed to find course or version id, try agian!');
        return;
      }
      await copyEntireCourseVersion({
        params: { path: { courseId, courseVersionId: selectedVersionId } },
      });
      queryClient.invalidateQueries({
        queryKey: ['get', '/users/enrollments'],
        exact: false,
      });
      toast.success('Version successfully copied');
    } catch (error: any) {
      console.log('Error: ', error);
      if (error?.name === 'ForbiddenError') {
        toast.error('Only administrators can clone this course version');
      } else {
        toast.error('Failed to clone version');
      }
    } finally {
      setIsCopyModalOpen(false);
    }
  };


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
      <ConfirmationModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        onConfirm={handleCopy}
        title="Clone Course"
        description="This will create a clone of the entire course version, including all modules and sections. Only instructor enrollments will be retained. You can edit the cloned version independently. Note: Only administrators can use this feature."
        confirmText="Clone"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={copyVersionIsPending}
        loadingText="Cloning..."
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <Card className="relative bg-card/95 backdrop-blur-sm border-l-4 border-l-primary/40   transition-all duration-300 min-w-0">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Version Header - Always Visible */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col xl:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-semibold text-foreground">{version.version}</h4>
                      <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-xs">
                        Version
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                        <BookOpen className="h-3 w-3" />
                        <span>{(version as any).modules?.length || 0} Modules</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                        <FileText className="h-3 w-3" />
                        <span>
                          {(version as any).modules?.reduce((acc: number, module: { sections?: any[] }) => acc + (module.sections?.length || 0), 0) || 0} Sections
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                        <Clock className="h-3 w-3" />
                        <span>Last updated {getUpdateMessage(version.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">

                  <ProjectSubmissionsDownloadButton
                    courseId={courseId || ""}
                    versionId={versionId || ""}
                    cohorts={existingCohorts}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-56">

                      {/* Support link */}
                      {(version as any)?.supportLink && (() => {
                        const link = (version as any).supportLink;
                        const isEmail = link.startsWith('mailto:') ||
                          (!link.startsWith('http://') && !link.startsWith('https://') && link.includes('@'));
                        const href = link.startsWith('mailto:')
                          ? link
                          : link.startsWith('http://') || link.startsWith('https://')
                            ? link
                            : link.includes('@')
                              ? `mailto:${link}`
                              : link;
                        return (
                          <>
                            <DropdownMenuItem asChild>
                              <a
                                href={href}
                                target={isEmail ? undefined : "_blank"}
                                rel={isEmail ? undefined : "noopener noreferrer"}
                                className="flex items-center"
                              >
                                <Headphones className="mr-2 h-4 w-4" />
                                Support
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        );
                      })()}

                      <DropdownMenuItem onClick={() => setShowAnnouncementModal(true)}>
                        <Megaphone className="mr-2 h-4 w-4" />
                        Announce
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => setIsCopyModalOpen(true)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Clone
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={configureCohorts}>
                        <Layers className="h-4 w-4 mr-2" />
                        Configure Cohorts
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={startEditingVersion} disabled={isArchived}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Reports section */}
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Reports</DropdownMenuLabel>
                      <DropdownMenuItem onClick={viewAnomalies}>
                        <Eye className="mr-2 h-4 w-4" />
                        Anomalies
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={viewFlags}>
                        <FlagTriangleRight className="mr-2 h-4 w-4" />
                        Flags
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Manage section */}
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Manage</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => {
                          setCurrentCourse({
                            courseId: courseId,
                            versionId: selectedVersionId ?? null,
                            moduleId: null,
                            sectionId: null,
                            itemId: null,
                            watchItemId: null,
                          });
                          storePageAndNavigate("/teacher/ejection-policies");
                        }}
                        disabled={isArchived}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Ejection Policies
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowProctoringModal(true);
                        }}
                        disabled={isArchived}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={configureCohorts}>
                        <Layers className="mr-2 h-4 w-4" />
                        Configure Cohorts
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        setShowProctoringModal(true)
                      }}
                        disabled={isArchived}
                        title={isArchived ? "Cannot open settings for archived version" : undefined}
                      >
                        <Settings2 className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={viewAnomalies}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Anomalies
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => setShowArchiveModal(true)}>
                        {isArchived ? (
                          <>
                            <Archive className="mr-2 h-4 w-4" />
                            Unarchive
                          </>
                        ) : (
                          <>
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            Archive
                          </>
                        )}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => setShowDeleteVersionModel(true)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Version
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                </div>

                <div className="relative group">
                  <ConfirmationModal
                    isOpen={showDeleteVersionModel}
                    onClose={() => setShowDeleteVersionModel(false)}
                    onConfirm={deleteVersion}
                    title="Delete Version"
                    description={versionCount === 1
                      ? "This is the last version of this course. Deleting it will also delete the entire course. Are you sure you want to continue?"
                      : "Are you sure you want to delete this version? This action cannot be undone."}
                    confirmText="Delete"
                    cancelText="Cancel"
                    isDestructive={true}
                    isLoading={deleteVersionMutation.isPending}
                    loadingText="Deleting..."
                  />
                  <ConfirmationModal
                    isOpen={showArchiveModal}
                    onClose={() => setShowArchiveModal(false)}
                    onConfirm={async () => {
                      await handleArchive();
                      setShowArchiveModal(false);
                    }}
                    title={isArchived ? "Unarchive Version" : "Archive Version"}
                    description={
                      isArchived
                        ? "Are you sure you want to unarchive this version? Students will be able to access it again."
                        : "Are you sure you want to archive this version? Students will no longer be able to access it."
                    }
                    confirmText={isArchived ? "Unarchive" : "Archive"}
                    cancelText="Cancel"
                    isDestructive={false}
                    isLoading={isArchivePending}
                    loadingText={isArchived ? "Unarchiving..." : "Archiving..."}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <AnnouncementModal
                    isOpen={showAnnouncementModal}
                    onClose={() => setShowAnnouncementModal(false)}
                    defaultType={AnnouncementType.VERSION_SPECIFIC}
                    courseId={courseId}
                    versionId={versionId}
                  />
                </div>
              </div>

              {/* Version Description Section - Show in edit mode or if description exists */}
              {(editingVersion || version?.description) && (
                <div className="space-y-4">
                  <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full"></div>
                    Version Details
                  </h4>
                  {editingVersion ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-light text-foreground mb-2 block">Version Name *</label>
                        <Input
                          value={editingValues.version}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditingValues((prev) => ({
                              ...prev,
                              version: value,
                            }))
                            if (!value.trim()) {
                              setEditingErrors(errors => ({ ...errors, version: "Version name is required." }));
                            } else if (value.trim().length < 3) {
                              setEditingErrors(errors => ({ ...errors, version: "Version name must be atleast 3 characters." }))
                            } else if (value.trim().length > 255) {
                              setEditingErrors(errors => ({ ...errors, version: "Version name must be less than 255 characters." }))
                            } else {
                              setEditingErrors(errors => ({ ...errors, version: '' }));
                            }
                          }}
                          className="border-primary/30 focus:border-primary bg-background"
                          placeholder="Version name"
                        />
                        {editingErrors.version && (
                          <div className="text-xs text-red-500 mt-2">{editingErrors.version}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-light text-foreground mb-2 block">Description *</label>
                        <Textarea
                          value={editingValues.description}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditingValues((prev) => ({
                              ...prev,
                              description: value,
                            }))
                            // Validation
                            if (!value.trim()) {
                              setEditingErrors(errors => ({ ...errors, description: "Version description is required." }));
                            } else if (value.trim().length > 1000) {
                              setEditingErrors(errors => ({ ...errors, description: "Description must be less than 1000 characters." }));
                            }
                            else {
                              setEditingErrors(errors => ({ ...errors, description: '' }));
                            }
                          }}
                          className="min-h-[120px] border-primary/30 focus:border-primary bg-background resize-none"
                          placeholder="Version description"
                        />
                        {editingErrors.description && (
                          <div className="text-xs text-red-500 mt-2">{editingErrors.description}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-light text-foreground mb-2 block">Support Link (Optional)</label>
                        <Input
                          value={editingValues.supportLink}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditingValues((prev) => ({
                              ...prev,
                              supportLink: value,
                            }))
                            setEditingErrors(errors => ({ ...errors, supportLink: '' }));

                          }}
                          className="border-primary/30 focus:border-primary bg-background"
                          placeholder="Discord, email, or forum link (e.g., https://discord.gg/abc123)"
                        />
                        {editingErrors.supportLink && (
                          <div className="text-xs text-red-500 mt-2">{editingErrors.supportLink}</div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Students can use this link to get help or support
                        </p>
                        {/* <div className="mt-4">
                          <label className="block text-sm font-medium mb-2">
                            Version Cohorts
                          </label>
                          <div className="flex flex-wrap items-center gap-2 border border-border rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20">
                          {existingCohorts.map(cohort => (
                            <span
                              key={cohort.id}
                              className="flex items-center gap-1 bg-muted text-muted-foreground px-2 py-1 rounded-full text-sm"
                            >
                              {cohort.name}
                            </span>
                          ))}
                          {newCohorts.map(cohort => (
                            <span
                              key={cohort}
                              className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm"
                            >
                              {cohort}
                              <button
                                type="button"
                                onClick={() => removeNewCohort(cohort)}
                                className="text-xs hover:text-destructive"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                            <input
                              type="text"
                              value={cohortInput}
                              onChange={e => setCohortInput(e.target.value)}
                              onKeyDown={handleKeyDown}
                              placeholder="Add a cohort name and press Enter"
                              className="flex-1 bg-transparent outline-none text-sm min-w-[120px]"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Press Enter or comma to add cohorts (max {MAX_COHORTS})
                          </p>
                      </div> */}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={saveEditingVersion}
                          size="sm"
                          disabled={updateVersionMutation.isPending}
                          className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                        >
                          {updateVersionMutation.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                          Save Changes
                        </Button>
                        <Button onClick={cancelEditingVersion} variant="outline" size="sm" className="border-border bg-background">
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    version?.description && (
                      <div className="relative">
                        <div className="absolute inset-0  rounded-lg "></div>
                        <div className="relative bg-accent/1 rounded-lg p-4 border border-accent/10">
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{version.description}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="flex items-center flex-wrap justify-start gap-3 shrink-0 pl-2 mt-4 pt-2 md:mt-0">



                {/* <Button variant="outline" size="sm" onClick={viewAnomalies} className="h-7 text-xs cursor-pointer">
                  <Eye className="h-3 w-3 mr-1" />
                  View Anomalies
                </Button> */}
                <Button variant="outline" size="sm" onClick={viewFlags} className="h-7 text-xs cursor-pointer">
                  <FlagTriangleRight className="h-3 w-3 mr-1" />
                  View Flags
                </Button>
                {/* <Button
                  variant="outline"
                  size="sm"
                  onClick={viewInstructors}
                  className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
                >
                  <UserCog2 className="h-3 w-3 mr-1" />
                  View Instructors
                </Button> */}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewEnrollments}
                  className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
                >
                  <Users className="h-3 w-3 mr-1" />
                  View Enrollments
                </Button>
                <Button variant="outline" size="sm" onClick={goToRegistrations} className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Registrations
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentCourse({
                      courseId: courseId,
                      versionId: selectedVersionId ?? null,
                      moduleId: null,
                      sectionId: null,
                      itemId: null,
                      watchItemId: null,
                    });
                    storePageAndNavigate("/teacher/ejection-policies");
                  }}
                  className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
                  disabled={isArchived}
                  title={isArchived ? "Cannot manage policies for archived version" : undefined}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Ejection Policies
                </Button>
                {/* <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateLink}
          className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
          disabled={generateLinkMutation.isPending}
        >
          {generateLinkMutation.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Link className="h-3 w-3 mr-1" /> 
          )}
          Generate Link
        </Button> */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewCourse}
                  className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
                // Manage remains enabled even for archived versions
                >
                  <BookOpenIcon className="h-3 w-3 mr-1" />
                  Manage
                </Button>
                {version.hpSystem &&
                  <Button
                    variant="outline"
                    size="sm"
                    size="sm"
                    className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
                    onClick={() => {
                    onClick={() => {
                      navigate({
                        to: `/teacher/hp-system/${version._id}/cohorts`,
                        state: {
                          from: location.pathname,
                        }
                      });
                    }}
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Hp System
                  </Button>
                }
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnnouncementModal(true)}
                  className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
                  disabled={isArchived}
                  title={isArchived ? "Cannot announce on archived version" : undefined}
                >
                  <Megaphone className="h-3 w-3 mr-1" />
                  Announce
                </Button>


                {/* <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowProctoringModal(true)
                  }}
                  className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300"
                  disabled={isArchived}
                  title={isArchived ? "Cannot open settings for archived version" : undefined}
                >
                  <Settings2 className="h-3 w-3 mr-1" />
                  Settings
                </Button> */}
                {/* <Button
                    variant="outline"
                    size="sm"
                    onClick={configureCohorts}
                    className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
                  >
                    <Layers className="h-3 w-3 mr-1" />
                    Configure Cohorts
                </Button> */}
              </div>
            </div>



            <ProctoringModal
              open={showProctoringModal}
              onClose={() => setShowProctoringModal(false)}
              courseId={courseId}
              courseVersionId={versionId}
              isNew={false}
              onSuccess={() => {
                queryClient.invalidateQueries({
                  queryKey: [
                    "get",
                    "/courses/versions/{id}",
                    { params: { path: { id: selectedVersionId } } },
                  ],
                })
              }}
            />

            <LinkModal
              open={showLinkModal}
              onClose={() => {
                setShowLinkModal(false);
                setGeneratedLink(''); // Optional: Clear link on close
              }}
              link={generatedLink}
            />
          </div>

        </CardContent>
      </Card>
    </div >


  )
}


// Added modal for link.
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"


interface LinkModalProps {
  open: boolean;
  onClose: () => void;
  link: string;
}

export function LinkModal({ open, onClose, link }: LinkModalProps) {
  const copyLink = async () => {
    if (navigator.clipboard && link) {
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Link copied to clipboard!");
      } catch (error) {
        console.error("Failed to copy link:", error);
        toast.error("Failed to copy link.");
      }
    }
  };

  if (!link) return null; // Safety: Don't render if no link

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            Generated Invitation Link
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground text-center">
            Share this unique link with your students to enroll them in the course.
          </p>

          <div className="p-3 bg-muted rounded-md border">
            <div className="flex items-center justify-between">
              <code className="text-sm font-mono break-all flex-1 min-w-0">
                {link}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyLink}
                className="ml-2 h-8 w-8 p-0"
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}