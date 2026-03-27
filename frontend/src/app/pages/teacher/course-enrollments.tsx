"use client"

import { useState, useEffect } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Search, Users, TrendingUp, CheckCircle, RotateCcw, UserX, BookOpen, FileText, List, Play, AlertTriangle, X, Loader2, Eye, Clock, ChevronRight, ChevronDown, ArrowUp, ArrowDown, BarChart3, Download, FileDown, CheckSquare, Check, Layers,Video, HelpCircle, RefreshCw } from 'lucide-react'
import { Pagination } from "@/components/ui/Pagination"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { QuizSubmissionDisplay } from "./QuizSubmissionDisplay"
import { WatchTimeDisplay } from "./WatchTimeDisplay"
import TimeSlotsModal from "./components/TimeSlotsModal"
import { useStudentCurrentProgressPath, useMoveToCohort } from "@/hooks/hooks"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { MoreVertical, Trash2 } from "lucide-react"
import CourseBackButton from "./CourseBackButton";

// Import hooks - including the new quiz hooks
import {
  useCourseById,
  useCourseVersionById,
  useItemsBySectionId,
  useCourseVersionEnrollments,
  useResetProgress,
  useUnenrollUser,
  useCourseEnrollmentsStats,
  useCourseQuizScores,
  useRecalculateProgress,
  useBulkUnenrollUsers,
  useChangeEnrollmentStatus,
  useBulkChangeEnrollmentStatus,
  useUserModuleProgress,
  useGetTimeSlots,
  useStudentProgressDetail,
  useStudentCourseStructure,
  useRecalculateStudentProgress,
} from "@/hooks/hooks"
import { toast } from "sonner"
import { useCourseStore } from "@/store/course-store"
import type { EnrolledUser, EnrollmentDetails } from "@/types/course.types"
import { useAuthStore } from "@/store/auth-store"
import { EnrollmentRole } from "@/types/invite.types"
import { generateExcel, generateStudentContactsExcel } from "@/lib/excel-export"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

// Types for quiz functionality


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
  });
}

// Component to display progress for each enrolled user
// Accepts either a number (percent or fraction) or an object with a progress property
function EnrollmentProgress(props: { progress: number }) {
  // Support both direct number and object prop
  const progress = props.progress;
  return (
    <div className={`flex  items-center gap-4 sm:w-40 w-full ${getProgressBg(progress)}`}>
      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden shadow-inner">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(progress)}`}
          style={{
            width: `${progress.toFixed(2)}%`,
            transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
      <span className="text-sm font-bold text-foreground min-w-[3rem] text-right">
        {progress.toFixed(2)}%
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

const getRoleBadge = (role: EnrollmentRole) => {
  const variants: Record<EnrollmentRole, string> = {
    INSTRUCTOR: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    STUDENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    MANAGER: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    TA: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    STAFF: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-purple-300",
  }

  return (
    <Badge variant="outline" className={variants[role]}>
      {role}
    </Badge>
  )
}

const getItemIcon = (type: string) => {
  switch (type?.toUpperCase()) {
    case "VIDEO":
      return <Video className="h-4 w-4 text-blue-600" />
    case "QUIZ":
      return <HelpCircle className="h-4 w-4 text-amber-600" />
    case "ARTICLE":
    case "BLOG":
      return <FileText className="h-4 w-4 text-emerald-600" />
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />
  }
}

export default function CourseEnrollments() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  // Get course info from store
  const { currentCourse } = useCourseStore()
  const courseId = currentCourse?.courseId
  const versionId = currentCourse?.versionId

  useEffect(() => {
    if (!currentCourse || !courseId || !versionId) {
      navigate({ to: '/teacher' });
    }
  }, [currentCourse, courseId, versionId, navigate]);
  // Fetch course and version data
  const { data: course, isLoading: courseLoading, error: courseError } = useCourseById(courseId || "")
  const { data: version, isLoading: versionLoading, error: versionError } = useCourseVersionById(versionId || "")

  // Fetch course anomalies stats
  const { data: enrollmentStats, isLoading: statsLoading, error: statsError } = useCourseEnrollmentsStats(
    courseId,
    versionId,
    !!(courseId && versionId)
  )

  const [selectedUser, setSelectedUser] = useState<EnrollmentDetails | null>(null)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false)
  const [isEnableDialogOpen, setIsEnableDialogOpen] = useState(false)
  const [isRecalculateProgressOpen, setIsRecalculateProgressOpen] = useState(false)
  const [isViewProgressDialogOpen, setIsViewProgressDialogOpen] = useState(false)
  const [userToRemove, setUserToRemove] = useState<EnrolledUser | null>(null)
  const [userToDisable, setUserToDisable] = useState<EnrolledUser | null>(null)
  const [userToEnable, setUserToEnable] = useState<EnrolledUser | null>(null)
  const [userToRecalculate, setUsertToRecalculate] = useState<EnrolledUser | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [resetScope, setResetScope] = useState<"course" | "module" | "section" | "item">("course")
  const [selectedModule, setSelectedModule] = useState<string>("")
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedItem, setSelectedItem] = useState<string>("")
const [isMoveCohortModalOpen, setIsMoveCohortModalOpen] = useState(false);
const [isMoveSelectionMode, setIsMoveSelectionMode] = useState(false);
const [moveSelectedUsers, setMoveSelectedUsers] = useState<Set<string>>(new Set());
const [selectedMoveCohort, setSelectedMoveCohort] = useState<string | null>(null);
const moveToCohortMutation = useMoveToCohort();

  // New states for view progress functionality
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [selectedViewItem, setSelectedViewItem] = useState<string>("")
  const [selectedViewItemType, setSelectedViewItemType] = useState<string>("")
  const [selectedViewItemName, setSelectedViewItemName] = useState<string>("")
  // Controls lazy-load of API 3 (Course Structure panel)
  const [showCourseStructure, setShowCourseStructure] = useState(false)

  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'enrollmentDate' | 'progress' | 'unenrolledAt'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Bulk Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [isBulkUnenrollDialogOpen, setIsBulkUnenrollDialogOpen] = useState(false)
  const [isBulkDisableDialogOpen, setIsBulkDisableDialogOpen] = useState(false)
  const [isBulkEnableDialogOpen, setIsBulkEnableDialogOpen] = useState(false)
  const [isInactiveSelectionMode, setIsInactiveSelectionMode] = useState(false)
  const [selectedInactiveUsers, setSelectedInactiveUsers] = useState<Set<string>>(new Set())
  const [isTimeSlotsModalOpen, setIsTimeSlotsModalOpen] = useState(false);

  // Get URL search params
  const search = useSearch({ strict: false }) as any
  const selectMode = search?.selectMode === "true"
  const excludeAssigned = search?.excludeAssigned === "true"

  // Time slots data for exclusion logic
  const { data: timeSlotsData } = useGetTimeSlots(
    courseId && courseId.length === 24 && versionId && versionId.length === 24
      ? courseId
      : undefined,
    versionId && versionId.length === 24
      ? versionId
      : undefined
  );

  // Get assigned student IDs
  const getAssignedStudentIds = () => {
    const assignedIds = new Set<string>();
    timeSlotsData?.slots?.forEach((slot: any) => {
      slot.studentIds?.forEach((id: string) => assignedIds.add(id));
    });
    return assignedIds;
  };

  // Get assigned timeslot for a student
  const getStudentTimeSlot = (studentId: string) => {
    if (!timeSlotsData?.slots) return null;

    for (const slot of timeSlotsData.slots) {
      if (slot.studentIds?.includes(studentId)) {
        return slot;
      }
    }
    return null;
  };

  // Handle student selection completion for time slots
  const handleTimeSlotStudentSelection = () => {
    if (selectedUsers.size > 0) {
      // Send selected students back to TimeSlotsModal
      window.dispatchEvent(new CustomEvent('studentSelectionComplete', {
        detail: { selectedStudentIds: Array.from(selectedUsers) }
      }));
      // Exit selection mode
      setIsSelectionMode(false);
    }
  };

  // Listen for enableSelectionMode event from TimeSlotsModal
  useEffect(() => {
    const handleEnableSelectionMode = (event: CustomEvent) => {
      const { slot } = event.detail;
      // Enable selection mode
      setIsSelectionMode(true);
      // Pre-select existing students for this slot
      setSelectedUsers(new Set(slot.studentIds));
    };

    window.addEventListener('enableSelectionMode', handleEnableSelectionMode as EventListener);
    return () => {
      window.removeEventListener('enableSelectionMode', handleEnableSelectionMode as EventListener);
    };
  }, []);

  // Auto-enable selection mode if URL params indicate it
  useEffect(() => {
    if (selectMode && !isSelectionMode) {
      setIsSelectionMode(true);
    }
  }, [selectMode]);



  // Fetch module progress for the selected user
  const { data: userModuleProgress, isLoading: moduleProgressLoading } = useUserModuleProgress(
    selectedUser?.id || "",
    courseId || "",
    versionId || "",
    selectedUser?.cohortId,
  )
// console.log("selectedUser cohort", selectedUser);
  const toggleSelectionMode = () => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // Clearing selection when turning off mode
        setSelectedUsers(new Set())
      }
      return !prev
    })
  }


  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers)
    if (checked) {
      newSelected.add(userId)
    } else {
      newSelected.delete(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleBulkUnenroll = () => {
    if (selectedUsers.size > 50) {
      toast.error('Cannot unenroll more than 50 students at once. Please select fewer students.')
      return
    }
    setIsBulkUnenrollDialogOpen(true)
  }

  const confirmBulkUnenroll = async () => {
    if (!courseId || !versionId) {
      toast.error('Course or version information missing')
      return
    }
    if(version?.cohorts?.length > 0 && !cohort) {
      toast.error('Please select a cohort for unenrollment')
      return;
    }

    try {
      const userIds = Array.from(selectedUsers)

      await bulkUnenrollMutation.mutateAsync({
        params: {
          path: {
            courseId,
            versionId,
          },
        },
        body: {
          userIds,
          cohortId: cohort,
        },
      })

      toast.success(`Successfully unenrolled ${selectedUsers.size} students`)
      setSelectedUsers(new Set())
      setIsBulkUnenrollDialogOpen(false)
      setIsSelectionMode(false)

      // Refetch enrollments to update the UI
      refetchEnrollments()
    } catch (error: any) {
      console.error('Bulk unenroll error:', error)
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        data: error?.data,
        status: error?.status,
      })
      toast.error(error?.message || error?.data?.message || 'Failed to unenroll students')
    }
  }



  //Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingStudentContacts, setIsExportingStudentContacts] = useState(false);

  const [showContentSummary, setShowContentSummary] = useState(false)
  function SummaryRow({
    label,
    value,
  }: {
    label: string
    value: string | number
  }) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-right min-w-16">{value ?? 0}</span>
      </div>
    )
  }


  // Quiz scores hook - using the hook directly with enabled: false to control when to fetch
  // const {
  //   data: quizScores,
  //   isLoading: isLoadingQuizScores,
  //   error: quizScoresError,
  //   refetch: fetchQuizScores,
  // } = useCourseQuizScores(courseId, versionId, isExporting,enrollmentTab);

  interface QuizScore {
    moduleId?: string;
    sectionId?: string;
    quizId?: string;
    quizName?: string;
    maxScore?: number;
    attempts?: number;
    questionScores?: Array<{
      questionId: string;
      score: number;
    }>;
  }

  // Define the student data type
  interface StudentData {
    studentId: string;
    name: string;
    email: string;
    cohortName?: string | null;
    quizScores?: QuizScore[];
  }

  const sanitizeFilenamePart = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  // Handle fetch and export quiz scores
  const handleFetchQuizScores = async () => {
    if (!courseId || !versionId) {
      toast.error('Course ID or Version ID is missing');
      return;
    }

    // Frontend validation: Check if cohort is selected and has students
    if (cohort) {
      const cohortName = (version as any)?.cohortDetails?.find((c: any) => c.id === cohort)?.name;
      
      const cohortStudents = filteredStudentEnrollments.filter((enrollment: any) => {
        // The cohort ID is stored directly on the enrollment object
        return enrollment.cohortId === cohort;
      });
      
      if (!cohortName) {
        toast.error('Selected cohort not found');
        return;
      }
      
      if (cohortStudents.length === 0) {
        toast.warning(`No students found in cohort: ${cohortName}`);
        return;
      }
    }

    if (!quizScores?.data?.length || isLoadingQuizScores) {
      const cohortName = cohort ? (version as any)?.cohortDetails?.find((c: any) => c.id === cohort)?.name : null;
      const message = cohort 
        ? `No quiz scores available for cohort: ${cohortName || 'selected cohort'}`
        : 'No quiz scores available';
      toast.warning(message);
      return;
    }
    if (isLoadingQuizScores) {
      toast.loading('Fetching quiz scores...');
      return;
    }

    // console.log("---quizscores------", quizScores);
    try {
      // âš¡ FAST: single-pass formatting, no unused maps
      const formattedData = quizScores.data.map(
        (student: any, index: number) => ({
          studentId: student.studentId ?? `student-${index}`,
          name: student.name ?? 'Unknown Student',
          email: student.email ?? '',
          cohortName: student.cohortName ?? null,
          quizScores: Array.isArray(student.quizScores)
            ? student.quizScores.map((quiz: any) => ({
              moduleId: quiz.moduleId ?? 'unknown',
              sectionId: quiz.sectionId ?? 'unknown',
              quizId: quiz.quizId ?? 'unknown',
              quizName: quiz.quizName ?? 'Untitled Quiz',
              moduleName: quiz.moduleName ?? 'Module',
              sectionName: quiz.sectionName ?? 'Section',
              maxScore: Number(quiz.maxScore) || 0,
              attempts: Number(quiz.attempts) || 0,
              questionScores: Array.isArray(quiz.questionScores)
                ? quiz.questionScores.map((q: any) => ({
                  questionId: String(q.questionId ?? ''),
                  score: Number(q.score) || 0,
                }))
                : [],
            }))
            : [],
        }),
      );

      if (!formattedData.length) {
        toast.warning('No quiz scores found to export');
        return;
      }

      // â±ï¸ Stable filename (no locale overhead)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
      const statusLabel = enrollmentTab === 'ACTIVE' ? 'active' : 'inactive';
      const cohortName = cohort ? (version as any)?.cohortDetails?.find((c: any) => c.id === cohort)?.name : null;
      const cohortLabel = cohortName ? `cohort-${cohortName.toLowerCase().replace(/\s+/g, '_')}_` : '';
      const filename = `quiz_scores_${cohortLabel}${statusLabel}_${timestamp}.xlsx`;

      // ðŸ§  Let UI breathe before heavy Excel generation
      await new Promise(resolve => setTimeout(resolve, 0));
// console.log("JSON.stringify(formattedData,---",JSON.stringify(formattedData, null, 2));
      generateExcel(formattedData, filename);
      toast.success(`${enrollmentTab.toLowerCase()} quiz scores exported successfully`);
    } catch (error) {
      console.error('Error exporting quiz scores:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to export quiz scores',
      );
    }
  };


  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      // Reset to first page when search term changes
      setCurrentPage(1);
      setDebouncedSearch(searchQuery);
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Active / Inactive tab
  const [enrollmentTab, setEnrollmentTab] = useState<"ACTIVE" | "INACTIVE">("ACTIVE")
  const statusTab: "ACTIVE" | "INACTIVE" = enrollmentTab
  const [activeCount, setActiveCount] = useState(0)
  const [inactiveCount, setInactiveCount] = useState(0)
  const [cohort, setCohort] = useState<string | null>(null);
  const {
    data: quizScores,
    isLoading: isLoadingQuizScores,
    error: quizScoresError,
    refetch: fetchQuizScores,
  } = useCourseQuizScores(courseId, versionId, isExporting, enrollmentTab, cohort);

  // Fetch enrollments data
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
    refetch: refetchEnrollments,
    isRefetching: isRefetchingEnrollments,
  } = useCourseVersionEnrollments(
    courseId,
    versionId,
    currentPage,
    limit,
    debouncedSearch,
    sortBy,
    sortOrder,
    !!(courseId && versionId),
    'STUDENT',
    statusTab,
    cohort,
  );
  // Active / Inactive tab
  useEffect(() => {
    setCurrentPage(1)
  }, [enrollmentTab])


  // const studentEnrollments = enrollmentsData?.enrollments || [];
  const studentEnrollments = enrollmentsData?.enrollments || []
  // Filter out already assigned students if excludeAssigned is true
  const filteredStudentEnrollments = excludeAssigned
    ? studentEnrollments.filter((enrollment: any) => {
      const assignedIds = getAssignedStudentIds();
      const studentId = enrollment.user?._id || enrollment.user?.id;
      return !assignedIds.has(studentId);
    })
    : studentEnrollments;


  const handleSelectAll = (checked: boolean) => {
    const visibleUserIds = filteredStudentEnrollments.map((e: any) => e.user?._id || e.user?.id).filter(Boolean)

    if (checked) {
      // Add all visible students to existing selections
      setSelectedUsers((prev) => {
        const newSet = new Set(prev)
        visibleUserIds.forEach((id: string) => newSet.add(id))
        return newSet
      })
    } else {
      // Remove all visible students from selections
      setSelectedUsers((prev) => {
        const newSet = new Set(prev)
        visibleUserIds.forEach((id: string) => newSet.delete(id))
        return newSet
      })
    }
  }


  // API Hooks
  const resetProgressMutation = useResetProgress()
  const unenrollMutation = useUnenrollUser()
  const bulkUnenrollMutation = useBulkUnenrollUsers()
  const changeStatusMutation = useChangeEnrollmentStatus()
  const bulkChangeStatusMutation = useBulkChangeEnrollmentStatus()
  const recalculateMutation = useRecalculateProgress()
  const recalculateStudentMutation = useRecalculateStudentProgress()

  // Disable/Enable handlers
  const handleDisableStudent = (enrollment: any) => {
    if (!courseId || !versionId) return
    setUserToDisable({
      id: enrollment.user?._id,
      name: `${enrollment?.user?.firstName || ""} ${enrollment?.user?.lastName || ""}`.trim() || "Unknown User",
      email: enrollment.user?.email,
      enrolledDate: enrollment.enrollmentDate,
      progress: enrollment.progress || 0,
      cohortId: enrollment.cohortId,
      cohortName: enrollment.cohortName
    })
    setIsDisableDialogOpen(true)
  }

  const handleEnableStudent = (enrollment: any) => {
    if (!courseId || !versionId) return
    setUserToEnable({
      id: enrollment.user?._id,
      name: `${enrollment?.user?.firstName || ""} ${enrollment?.user?.lastName || ""}`.trim() || "Unknown User",
      email: enrollment.user?.email,
      enrolledDate: enrollment.enrollmentDate,
      progress: enrollment.progress || 0,
      cohortId: enrollment.cohortId,
      cohortName: enrollment.cohortName
    })
    setIsEnableDialogOpen(true)
  }

  const confirmDisableStudent = async () => {
    if (userToDisable && courseId && versionId) {
      try {
        await changeStatusMutation.mutateAsync({
          params: {
            path: {
              userId: userToDisable.id,
              courseId,
              versionId,
            },
          },
          body: { 
            status: 'INACTIVE',
            cohortId: userToDisable.cohortId 
          },
        })
        toast.success(`${userToDisable.name} has been disabled`)
        setIsDisableDialogOpen(false)
        setUserToDisable(null)
        queryClient.invalidateQueries({ queryKey: ["get", "/users/enrollments/courses/{courseId}/versions/{courseVersionId}"] })
        refetchEnrollments()
      } catch (error: any) {
        toast.error(error?.message || 'Failed to disable student')
      }
    }
  }

  const confirmEnableStudent = async () => {
    if (userToEnable && courseId && versionId) {
      try {
        await changeStatusMutation.mutateAsync({
          params: {
            path: {
              userId: userToEnable.id,
              courseId,
              versionId,
            },
          },
          body: { 
            status: 'ACTIVE',
            cohortId: userToEnable.cohortId
          },
        })
        toast.success(`${userToEnable.name} has been enabled`)
        setIsEnableDialogOpen(false)
        setUserToEnable(null)
        queryClient.invalidateQueries({ queryKey: ["get", "/users/enrollments/courses/{courseId}/versions/{courseVersionId}"] })
        refetchEnrollments()
      } catch (error: any) {
        toast.error(error?.message || 'Failed to enable student')
      }
    }
  }

  const handleBulkDisable = () => {
    if (selectedUsers.size > 50) {
      toast.error('Cannot disable more than 50 students at once')
      return
    }
    setIsBulkDisableDialogOpen(true)
  }

  const handleBulkEnable = () => {
    if (selectedInactiveUsers.size > 50) {
      toast.error('Cannot enable more than 50 students at once')
      return
    }
    setIsBulkEnableDialogOpen(true)
  }

  const confirmBulkDisable = async () => {
    if (!courseId || !versionId) return
    try {
      await bulkChangeStatusMutation.mutateAsync({
        params: { path: { courseId, versionId } },
        body: { userIds: Array.from(selectedUsers), status: 'INACTIVE', cohortId: cohort },
      })
      toast.success(`Successfully disabled ${selectedUsers.size} students`)
      setSelectedUsers(new Set())
      setIsSelectionMode(false)
      setIsBulkDisableDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["get", "/users/enrollments/courses/{courseId}/versions/{courseVersionId}"] })
      refetchEnrollments()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to disable students')
    }
  }

  const confirmBulkEnable = async () => {
    if (!courseId || !versionId) return
    try {
      await bulkChangeStatusMutation.mutateAsync({
        params: { path: { courseId, versionId } },
        body: { userIds: Array.from(selectedInactiveUsers), status: 'ACTIVE', cohortId: cohort },
      })
      toast.success(`Successfully enabled ${selectedInactiveUsers.size} students`)
      setSelectedInactiveUsers(new Set())
      setIsInactiveSelectionMode(false)
      setIsBulkEnableDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["get", "/users/enrollments/courses/{courseId}/versions/{courseVersionId}"] })
      refetchEnrollments()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to enable students')
    }
  }


  // Pagination state
  const totalDocuments = enrollmentsData?.totalDocuments || 0
  const {
    data: exportEnrollmentsData,
    isLoading: isLoadingStudentContacts,
  } = useCourseVersionEnrollments(
    courseId,
    versionId,
    1,
    Math.max(totalDocuments, 1),
    debouncedSearch,
    sortBy,
    sortOrder,
    isExportingStudentContacts,
    'STUDENT',
    statusTab,
    cohort,
  );

  useEffect(() => {
    if (enrollmentTab === "ACTIVE") {
      setActiveCount(totalDocuments)
    } else {
      setInactiveCount(totalDocuments)
    }
  }, [totalDocuments, enrollmentTab])
  const totalPages = enrollmentsData?.totalPages || 1
// console.log("enrollmentsData--------------", enrollmentsData);

  // Sorting handler
  const handleSort = (column: 'name' | 'enrollmentDate' | 'progress' | "scoreObtained" | "unenrolledAt") => {
    if (column === "scoreObtained") return;
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleExportStudentContacts = async () => {
    if (!courseId || !versionId) {
      toast.error('Course ID or Version ID is missing');
      return;
    }

    if (!totalDocuments) {
      toast.warning('No students found to export');
      return;
    }

    const enrollments = exportEnrollmentsData?.enrollments || [];

    if (!enrollments.length) {
      toast.warning('No students found to export');
      return;
    }

    try {
      const formattedData = enrollments.map((enrollment: any) => ({
        name:
          `${enrollment?.user?.firstName ?? ''} ${enrollment?.user?.lastName ?? ''}`.trim() ||
          'Unknown User',
        email: enrollment?.user?.email || '',
      }));

      const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
      const statusLabel = enrollmentTab === 'ACTIVE' ? 'active' : 'inactive';
      const courseLabel = sanitizeFilenamePart(course?.name || 'course');
      const cohortName = cohort
        ? (version as any)?.cohortDetails?.find((item: any) => item.id === cohort)?.name
        : null;
      const cohortLabel = cohortName
        ? `${sanitizeFilenamePart(cohortName)}_`
        : '';
      const filename = `${courseLabel}_${cohortLabel}${statusLabel}_student_contacts_${timestamp}.xlsx`;

      generateStudentContactsExcel(formattedData, filename);
      toast.success('Student contacts exported successfully');
    } catch (error) {
      console.error('Error exporting student contacts:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to export student contacts',
      );
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
      setShowCourseStructure(false)
    }
  }, [isViewProgressDialogOpen])

  useEffect(() => {
    if (isExporting && !isLoadingQuizScores) {

      handleFetchQuizScores().finally(() => setIsExporting(false));
    }
  }, [isExporting, isLoadingQuizScores]);

  useEffect(() => {
    if (isExportingStudentContacts && !isLoadingStudentContacts) {
      handleExportStudentContacts().finally(() => setIsExportingStudentContacts(false));
    }
  }, [isExportingStudentContacts, isLoadingStudentContacts, exportEnrollmentsData]);

  const handleResetProgress = (user: EnrolledUser) => {
    setSelectedUser(user)
    setIsResetDialogOpen(true)
  }

  const handleViewProgress = (user: EnrollmentDetails) => {
    setSelectedUser(user)

    setIsViewProgressDialogOpen(true)
  }


  const handleRemoveStudent = (user: EnrolledUser) => {
    // console.log("Preparing to remove student:", user);
    setUserToRemove(user)
    setIsRemoveDialogOpen(true)
  }

  const handleRecalculateProgress = (user: EnrolledUser) => {
    setUsertToRecalculate(user)
    setIsRecalculateProgressOpen(true)
  }

  const confirmRemoveStudent = async () => {
    if (userToRemove && courseId && versionId) {
      // console.log("Attempting to remove student:", userToRemove);
      try {
        await unenrollMutation.mutateAsync({
          params: {
            path: {
              userId: userToRemove.id,
              courseId: courseId,
              courseVersionId: versionId,
            },
          },
          body: {
            cohortId: userToRemove.cohortId,
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

  const confirmReCalculateProgress = async () => {
    if (userToRecalculate && courseId) {
      const userId = userToRecalculate?.id ?? undefined;
      try {
        await recalculateStudentMutation.mutateAsync({
          body: {
            userId: userId,
            courseId: courseId,
            courseVersionId: versionId,
            cohortId: selectedUser?.cohortId,
          },
        })
        setIsRecalculateProgressOpen(false)
        setUsertToRecalculate(null)
        refetchEnrollments()
        toast.success("Progress recalculated successfully")
      } catch (error: any) {
        console.error("Failed to recalculate progress:", error)
        toast.error(error?.message || "Failed to recalculate progress")
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
      if(selectedUser.cohortId) {
        requestBody.cohortId = selectedUser.cohortId
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

  // Get available modules from version data or API 3
  const getAvailableModules = () => {
    return courseStructureData?.courseStructure?.modules || version?.modules || []
  }

  // Get available sections from selected module
  const getAvailableSections = () => {
    const modules = getAvailableModules()
    if (!selectedModule || !modules) return []
    const module = modules.find((m: any) => m.moduleId === selectedModule)
    return module?.sections || []
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

const handleMoveSelectUser = (enrollment: any, checked: boolean) => {
  const enrollmentId = enrollment.id;

  setMoveSelectedUsers(prev => {
    const newSet = new Set(prev);

    if (checked) newSet.add(enrollmentId);
    else newSet.delete(enrollmentId);

    return newSet;
  });
};


const handleMoveSelectAll = (checked: boolean) => {
  const validEnrollmentIds = filteredStudentEnrollments
    .filter((e: any) => !e.cohortId)
    .map((e: any) => e.id);

  setMoveSelectedUsers(prev => {
    const newSet = new Set(prev);

    validEnrollmentIds.forEach(id => {
      if (checked) newSet.add(id);
      else newSet.delete(id);
    });

    return newSet;
  });
};

const handleMoveToCohort = async () => {
  if (!selectedMoveCohort) {
    toast.error("Select target cohort");
    return;
  }

  if (moveSelectedUsers.size === 0) {
    toast.error("No students selected");
    return;
  }

  const enrollmentIds = Array.from(moveSelectedUsers);

  if (!enrollmentIds.length) {
    toast.warning("Nothing to move");
    return;
  }

  if(!courseId || !versionId) {
    toast.error("Course or version information missing");
    return;
  }

  try {
    await moveToCohortMutation.mutateAsync({
      params: {
        path: {
          courseId,
          versionId,
        },
      },
      body: {
        enrollmentIds,
        targetCohortId: selectedMoveCohort,
      },
    });

    toast.success("Students moved successfully");

    // Reset state
    setMoveSelectedUsers(new Set());
    setIsMoveSelectionMode(false);
    setIsMoveCohortModalOpen(false);

    // Refresh data
    refetchEnrollments();

  } catch (error: any) {
    toast.error(error?.message || "Failed to move students");
  }
};


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
  // Use API stats data or fallback to manual calculations
  // const totalUsers = anomaliesStats?.totalEnrolled ?? enrollmentsData?.totalDocuments ?? 0
  // const completedUsers = anomaliesStats?.completedCount ?? enrollmentsData?.enrollments?.filter(
  //   (enrollment: any) => (enrollment.progress?.percentCompleted || 0) >= 1
  // ).length ?? 0
  // const averageProgress = anomaliesStats?.averageProgressPercent ?? (
  //   enrollmentsData?.totalDocuments > 0
  //     ? (
  //       enrollmentsData?.enrollments?.reduce(
  //         (sum: number, enrollment: any) => sum + ((enrollment.progress?.percentCompleted || 0) * 100),
  //         0
  //       ) / enrollmentsData.totalDocuments
  //     ).toFixed(1)
  //     : 0
  // )

  const stats = [
    {
      title: "Total Enrolled",
      value: enrollmentStats?.totalEnrollments ?? 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Completed",
      value: enrollmentStats?.completedCount ?? 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Avg. Progress",
      value: `${Number(enrollmentStats?.averageProgressPercent || 0).toFixed(2)}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
     {
      title: "Avg Watch Hours",
      value: (() => {
        const v = enrollmentStats?.averageWatchHoursPerUser ?? 0;
        if (v <= 0) return `0h`;
        if (v < 0.005) return `<0.01h`;
        return `${v.toFixed(2)}h`;
      })(),
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ]
  const {
    data: currentPath,
    error: pathError,
  } = useStudentCurrentProgressPath(
    selectedUser?.id,
    courseId,
    versionId,
    isViewProgressDialogOpen && showCourseStructure,
    selectedUser?.cohortId
  )


  // API 2: Student progress detail — fetched when View Progress modal opens
  const {
    data: progressDetail,
    isLoading: progressDetailLoading,
  } = useStudentProgressDetail(
    selectedUser?.id,
    courseId,
    versionId,
    isViewProgressDialogOpen,
    selectedUser?.cohortId
  )
  // API 3: Course structure — fetched lazily when View Course Structure is clicked
  const {
    data: courseStructureData,
    isLoading: courseStructureLoading,
  } = useStudentCourseStructure(
    selectedUser?.id,
    courseId,
    versionId,
    isViewProgressDialogOpen && showCourseStructure,
    selectedUser?.cohortId
  )

  // ===== Derived progress helpers =====


  // Redirect state
  if (!currentCourse || !courseId || !versionId) {
    return null;
  }

  // Loading state
  if ((courseLoading || versionLoading) && !course && !version) {
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
  if (courseError || versionError || (enrollmentsError && !debouncedSearch) || !course || !version || statsError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div>
            <Button className="bg-primary text-primary-foreground" onClick={() => navigate({ to: "/teacher" })}>Go Back</Button>
          </div>
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
    <>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-4 space-y-8">
          <CourseBackButton />
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
                  <span className="text-lg text-muted-foreground">&bull;</span>
                  <h3 className="text-base md:text-lg lg:text-xl font-semibold text-accent">{version.version}</h3>
                </div>
                <div className="h-1 w-32 bg-gradient-to-r from-primary to-accent rounded-full ml-4"></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchEnrollments()}
                disabled={isRefetchingEnrollments}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetchingEnrollments ? "animate-spin" : ""}`} />
                {isRefetchingEnrollments ? "Refreshing..." : "Refresh"}
              </Button>
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
          {statsLoading?<>
           <div className="ml-6 p-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading statistics...</span>
        </div>
      </div>
          </>:<div className="flex lg:flex-nowrap flex-wrap gap-6">
            {stats.map((stat) => (
              <Card key={stat.title} className="border-0 shadow-sm hover:shadow-md transition-shadow w-full">
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
          </div>}

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search students by user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value?.toLowerCase())}
                className="pl-12 h-12 border-border bg-card text-card-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              />
              <X className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchQuery("");
                }} />
            </div>


            {/* Time Slot Selection Mode Header */}
            {(selectMode || isSelectionMode) && (
              <div className="flex items-center gap-3">
                <div className="bg-card border border-border rounded-lg px-4 py-2">
                  <p className="text-sm text-card-foreground font-medium">
                    Select students for time slot assignment
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedUsers.size} student{selectedUsers.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <Button
                  onClick={handleTimeSlotStudentSelection}
                  disabled={selectedUsers.size === 0}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Selection
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsSelectionMode(false)}
                  className="border-border text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>



          {/* Students Table */}
          {/* Students Table + Tabs */}
          <Tabs
            value={enrollmentTab}
            onValueChange={(v) => setEnrollmentTab(v as "ACTIVE" | "INACTIVE")}
            className="w-full"
          >
            {/* Tabs Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="grid w-full sm:w-[420px] grid-cols-2 h-11 bg-muted/30 p-1 rounded-xl">
                <TabsTrigger
                  value="ACTIVE"
                  className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold"
                >
                  Active Students({activeCount})
                </TabsTrigger>

                <TabsTrigger
                  value="INACTIVE"
                  className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm font-semibold"
                >
                  Inactive Students({inactiveCount})
                </TabsTrigger>
              </TabsList>
              {(version as any)?.cohortDetails?.length > 0 && (
                <span className="relative flex justify-end right-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMoveCohortModalOpen(true)}
                  >
                    <Layers className="h-4 w-4 text-muted-foreground mr-2" />
                    Move students to cohort
                  </Button>
                </span>
              )}
            </div>
            {/* Active Tab */}
            <TabsContent value="ACTIVE" className="mt-4">
              <EnrollmentsTable
                studentEnrollments={filteredStudentEnrollments}
                enrollmentsLoading={enrollmentsLoading}
                isSearching={isSearching}
                enrollmentTab={enrollmentTab}
                searchQuery={searchQuery}
                limit={limit}
                handleLimitChange={handleLimitChange}
                handleSort={handleSort}
                sortBy={sortBy}
                sortOrder={sortOrder}
                isLoadingQuizScores={isLoadingQuizScores}
                setIsExporting={setIsExporting}
                isExportingStudentContacts={isLoadingStudentContacts}
                setIsExportingStudentContacts={setIsExportingStudentContacts}
                unenrollMutation={unenrollMutation}
                changeStatusMutation={changeStatusMutation}
                bulkChangeStatusMutation={bulkChangeStatusMutation}
                user={user}
                handleViewProgress={handleViewProgress}
                handleRemoveStudent={handleRemoveStudent}
                handleDisableStudent={handleDisableStudent}
                handleEnableStudent={handleEnableStudent}
                isSelectionMode={isSelectionMode}
                selectedUsers={selectedUsers}
                onSelectUser={handleSelectUser}
                onSelectAll={handleSelectAll}
                toggleSelectionMode={toggleSelectionMode}
                handleBulkUnenroll={handleBulkUnenroll}
                handleBulkDisable={handleBulkDisable}
                setIsTimeSlotsModalOpen={setIsTimeSlotsModalOpen}
                getStudentTimeSlot={getStudentTimeSlot}
                version={version}
                cohort={cohort}
                setCohort={setCohort}
              />
            </TabsContent>

            {/* Inactive Tab */}
            <TabsContent value="INACTIVE" className="mt-4">
              <EnrollmentsTable
                studentEnrollments={studentEnrollments}
                enrollmentsLoading={enrollmentsLoading}
                isSearching={isSearching}
                enrollmentTab={enrollmentTab}
                searchQuery={searchQuery}
                limit={limit}
                handleLimitChange={handleLimitChange}
                handleSort={handleSort}
                sortBy={sortBy}
                sortOrder={sortOrder}
                isLoadingQuizScores={isLoadingQuizScores}
                setIsExporting={setIsExporting}
                isExportingStudentContacts={isLoadingStudentContacts}
                setIsExportingStudentContacts={setIsExportingStudentContacts}
                unenrollMutation={unenrollMutation}
                changeStatusMutation={changeStatusMutation}
                bulkChangeStatusMutation={bulkChangeStatusMutation}
                user={user}
                handleViewProgress={handleViewProgress}
                handleRemoveStudent={handleRemoveStudent}
                handleDisableStudent={handleDisableStudent}
                handleEnableStudent={handleEnableStudent}
                isSelectionMode={isInactiveSelectionMode}
                selectedUsers={selectedInactiveUsers}
                onSelectUser={(userId, checked) => {
                  const newSet = new Set(selectedInactiveUsers)
                  checked ? newSet.add(userId) : newSet.delete(userId)
                  setSelectedInactiveUsers(newSet)
                }}
                onSelectAll={(checked) => {
                  const visibleIds = studentEnrollments.map((e: any) => e.user?._id || e.user?.id).filter(Boolean)
                  if (checked) {
                    setSelectedInactiveUsers(prev => { const s = new Set(prev); visibleIds.forEach((id: string) => s.add(id)); return s })
                  } else {
                    setSelectedInactiveUsers(prev => { const s = new Set(prev); visibleIds.forEach((id: string) => s.delete(id)); return s })
                  }
                }}
                toggleSelectionMode={() => {
                  setIsInactiveSelectionMode(prev => { if (prev) setSelectedInactiveUsers(new Set()); return !prev })
                }}
                handleBulkUnenroll={handleBulkUnenroll}
                handleBulkEnable={handleBulkEnable}
                setIsTimeSlotsModalOpen={setIsTimeSlotsModalOpen}
                getStudentTimeSlot={getStudentTimeSlot}
                version={version}
                cohort={cohort}
                setCohort={setCohort}
              />
            </TabsContent>
          </Tabs>


          {/* Enhanced View Progress Modal */}

          {isViewProgressDialogOpen && selectedUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
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

                {/* Enhanced Student Info & Content Summary */}
                <div className="flex flex-wrap items-center gap-4 p-6 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border">
                  <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md">
                    <AvatarImage src={selectedUser.avatar || "/placeholder.svg"} alt={selectedUser.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                      {selectedUser.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground truncate text-base md:text-lg">{selectedUser.name}</p>
                    <p className="text-muted-foreground truncate">{selectedUser.email}</p>
                    {selectedUser.cohortName && (
                      <p className="text-muted-foreground truncate">Cohort: {selectedUser.cohortName}</p>
                    )}
                  </div>

                  {/* Content Summary — loaded from API 2 */}
                  <div className="border border-border rounded-lg ml-auto p-3 min-w-[240px]">
                    <p className="font-medium text-sm mb-2">Content Summary</p>
                    {progressDetailLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading progress...
                      </div>
                    ) : progressDetail ? (
                      <>
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-sm text-muted-foreground">Completion</p>
                          <EnrollmentProgress progress={Math.min(progressDetail?.percentCompleted ?? 0, 100)} /> 
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <SummaryRow label="Total Items" value={progressDetail.contentCounts?.totalItems ?? 0} />
                          <SummaryRow label="Videos" value={progressDetail.contentCounts?.itemCounts?.VIDEO ?? 0} />
                          <SummaryRow label="Quizzes" value={progressDetail.contentCounts?.itemCounts?.QUIZ ?? 0} />
                          <SummaryRow label="Articles" value={progressDetail.contentCounts?.itemCounts?.BLOG ?? 0} />
                          <SummaryRow label="Projects" value={progressDetail.contentCounts?.itemCounts?.PROJECT ?? 0} />
                          <SummaryRow label="Feedbacks" value={progressDetail.contentCounts?.itemCounts?.FEEDBACK ?? 0} />
                          <SummaryRow
                            label="Quiz Score"
                            value={`${progressDetail.totalQuizScore ?? 0} / ${progressDetail.totalQuizMaxScore ?? 0}`}
                          />
                          <SummaryRow
                            label="Items Completed"
                            value={`${Math.min(progressDetail.completedItemsCount ?? 0, progressDetail.contentCounts?.totalItems ?? 0)} / ${progressDetail.contentCounts?.totalItems ?? 0}`}
                          />
                           <SummaryRow
                            label="Watch Hours"
                            value={`${(progressDetail.watchHours ?? 0).toFixed(2)}h`}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No progress data found</p>
                    )}
                  </div>
                </div>

                {/* View Course Structure button — lazy loads API 3 */}
                <div className="flex justify-center mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCourseStructure(true)}
                    disabled={showCourseStructure}
                    className="gap-2 cursor-pointer"
                  >
                    {courseStructureLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Loading Course Structure...</>
                    ) : (
                      <><BookOpen className="h-4 w-4" /> View Course Structure</>
                    )}
                  </Button>
                </div>
                {/* Current Learning Position & Course Structure gated by API 3 */}
                {showCourseStructure && (
                  <div className="space-y-6">

                    {/* Current Learning Position */}
                    <div className="space-y-2 p-4 rounded-lg border border-border bg-muted/20">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        Current Learning Position
                      </h4>

                      {pathError && (
                        <div className="text-sm text-destructive">
                          <p>Failed to load current progress</p>
                          <p className="text-xs mt-1">Error: {pathError.message || 'Unknown error'}</p>
                        </div>
                      )}

                      {!currentPath && !pathError && (
                        <p className="text-sm text-muted-foreground">
                          Progress not started yet
                        </p>
                      )}

                      {currentPath && currentPath.message && (
                        <div className="text-sm text-muted-foreground">
                          <p>{currentPath.message}</p>
                        </div>
                      )}

                      {currentPath && currentPath.module && (
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">
                            {currentPath.module.name}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                            {currentPath.section.name}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <span className="px-2 py-1 rounded bg-purple-100 text-purple-700">
                            {currentPath.item.name}
                          </span>
                          <span className="ml-2 text-xs px-2 py-0.5 rounded border">
                            {currentPath.item.type}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Course Structure */}
                    <div className="space-y-4">
                      {enrollmentTab === "ACTIVE" && (
                        <div className="flex justify-between">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleResetProgress({
                                      id: selectedUser.id,
                                      name: `${selectedUser.name || ""}`.trim() || "Unknown User",
                                      email: selectedUser.email,
                                      enrolledDate: selectedUser.enrolledDate,
                                      progress: 0,
                                      cohortId: selectedUser.cohortId,
                                      cohortName: selectedUser.cohortName,
                                    })
                                  }
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all duration-200 cursor-pointer"
                                  disabled={resetProgressMutation.isPending || selectedUser.isDeleted}
                                >
                                  {resetProgressMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                  )}
                                  Reset
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset student progress</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleRecalculateProgress({
                                      id: selectedUser.id,
                                      name: `${selectedUser.name || ""}`.trim() || "Unknown User",
                                      email: selectedUser.email,
                                      enrolledDate: selectedUser.enrolledDate,
                                      progress: 0,
                                      cohortId: selectedUser.cohortId,
                                      cohortName: selectedUser.cohortName,
                                    })
                                  }
                                  className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                                  disabled={
                                    unenrollMutation.isPending ||
                                    user?.email == selectedUser.email ||
                                    selectedUser.isDeleted
                                  }
                                >
                                  {unenrollMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                  )}
                                  Recalculate
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Recalculate student progress</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                      {/* add the code here */}
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
                              <span className="font-semibold text-foreground flex-1">{module.name}</span>

                              {/* Module completion count */}
                              {(() => {
                                // Find progress for this module from the API response
                                const moduleProgress = userModuleProgress?.modules?.find(
                                  (m: any) => m.moduleId === module.moduleId
                                );

                                if (moduleProgress) {
                                  const { totalItems, completedItems } = moduleProgress;
                                  const completedText = totalItems > 0
                                    ? `${completedItems}/${totalItems} completed`
                                    : 'No items';

                                  return (
                                    <span className="text-xs ml-auto text-muted-foreground">
                                      {completedText}
                                    </span>
                                  );
                                }

                                let totalItems = 0;
                                module.sections?.forEach((section: any) => {
                                  totalItems += section.itemCount || 0;
                                });

                                const loadingText = moduleProgressLoading
                                  ? `${totalItems} items (loading...)`
                                  : `${totalItems} items`;

                                return (
                                  <span className="text-xs ml-auto text-muted-foreground">
                                    {loadingText}
                                  </span>
                                );
                              })()}
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
                                        }}
                                      />
                                    )}
                                  </div>
                                )) || (
                                    <p className="text-sm text-muted-foreground ml-6">
                                      No sections in this module
                                    </p>
                                  )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>              {/* Item Details Display */}
                      {selectedViewItem && (
                        <div className="space-y-4">
                          {selectedViewItemType?.toUpperCase() === 'QUIZ' ? (
                            <QuizSubmissionDisplay
                              userId={selectedUser.id}
                              quizId={selectedViewItem}
                              itemName={selectedViewItemName}
                              cohortId={selectedUser.cohortId}
                            />
                          ) : (
                            <WatchTimeDisplay
                              userId={selectedUser.id}
                              itemId={selectedViewItem}
                              courseId={courseId!}
                              courseVersionId={versionId}
                              itemName={selectedViewItemName}
                              itemType={selectedViewItemType}
                              cohortId={selectedUser.cohortId}
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
              </div>
            </div>
          )}

          {isRemoveDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
                onClick={() => setIsRemoveDialogOpen(false)}
              />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl sm:max-w-lg max-[425px]:w-[90vw] w-full mx-4 sm:p-10 p-5 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-card-foreground">Remove Student</h2>
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
                    {course.name} ({version.version}) {userToRemove?.cohortName}
                  </strong>
                  ?
                </p>

                  <div className="flex gap-4 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                    <div><AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" /></div>
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

          {isDisableDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
                onClick={() => setIsDisableDialogOpen(false)}
              />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl sm:max-w-lg max-[425px]:w-[90vw] w-full mx-4 sm:p-10 p-5 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-card-foreground">Disable Student</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDisableDialogOpen(false)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-8">
                  <p className="text-lg text-card-foreground">
                    Want to disable <strong className="text-primary">{userToDisable?.name}</strong> from{" "}
                    <strong className="text-primary">
                      {course.name} ({version.version}) {userToDisable?.cohortName}
                    </strong>
                    ?
                  </p>

                  <div className="flex gap-4 p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div><AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" /></div>
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Warning:</strong> This student will be set to inactive. You can re-enable them from the Inactive tab.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsDisableDialogOpen(false)}
                    className="min-w-[100px] cursor-pointer"
                  >
                    No, Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmDisableStudent}
                    disabled={changeStatusMutation.isPending}
                    className="min-w-[100px] shadow-lg cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {changeStatusMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Disabling...
                      </>
                    ) : (
                      "Yes, Disable"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isEnableDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
                onClick={() => setIsEnableDialogOpen(false)}
              />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl sm:max-w-lg max-[425px]:w-[90vw] w-full mx-4 sm:p-10 p-5 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-card-foreground">Enable Student</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEnableDialogOpen(false)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-8">
                  <p className="text-lg text-card-foreground">
                    Want to enable <strong className="text-primary">{userToEnable?.name}</strong> for{" "}
                    <strong className="text-primary">
                      {course.name} ({version.version}) {userToEnable?.cohortName}
                    </strong>
                    ?
                  </p>

                  <div className="flex gap-4 p-6 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl">
                    <div><CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" /></div>
                    <div className="text-sm text-green-800 dark:text-green-200">
                      This student will be moved back to the Active tab.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsEnableDialogOpen(false)}
                    className="min-w-[100px] cursor-pointer"
                  >
                    No, Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={confirmEnableStudent}
                    disabled={changeStatusMutation.isPending}
                    className="min-w-[100px] shadow-lg cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                  >
                    {changeStatusMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enabling...
                      </>
                    ) : (
                      "Yes, Enable"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isRecalculateProgressOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
                onClick={() => setIsRecalculateProgressOpen(false)}
              />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl sm:max-w-lg max-[425px]:w-[90vw] w-full mx-4 sm:p-10 p-5 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-card-foreground">Recalculate Progress</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRecalculateProgressOpen(false)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-8">
                  <p className="text-lg text-card-foreground">
                    Want to Recalculate progress of <strong className="text-primary">{userToRecalculate?.name}</strong>
                    ?
                  </p>

                  {/* <div className="flex gap-4 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                  <div><AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" /></div>
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <strong>Warning:</strong> This action cannot be undone. The student will lose access to the course
                    version and all their progress data.
                  </div>
                </div> */}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsRecalculateProgressOpen(false)}
                    className="min-w-[100px] cursor-pointer"
                  >
                    No, Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmReCalculateProgress}
                    disabled={recalculateMutation.isPending}
                    className="min-w-[100px] shadow-lg cursor-pointer"
                  >
                    {recalculateStudentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Recalculating...
                      </>
                    ) : (
                      "Yes, Recalculate"
                    )}
                  </Button>
                </div>
              </div>
            </div>
        )}


          {/* Enhanced Reset Progress Modal */}
          {isResetDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
                onClick={() => setIsResetDialogOpen(false)}
              />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full mx-4 sm:p-8 p-4 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-card-foreground">Reset Student Progress</h2>
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
                      {selectedUser.cohortName && (
                        <p className="text-muted-foreground truncate">Cohort: {selectedUser.cohortName}</p>
                      )}
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

                <div className="space-y-8 flex justify-around flex-wrap">
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
                          <div className="flex items-center sm:gap-3 gap-1 py-3 sm:px-2">
                            <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <div>
                              <div className="font-semibold">Entire Course Version</div>
                              <div className="text-xs text-muted-foreground">Reset all progress in this version</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="module" className="cursor-pointer" >
                          <div className="flex items-center sm:gap-3 gap-1 py-3 sm:px-2">
                            <List className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            <div>
                              <div className="font-semibold">Specific Module</div>
                              <div className="text-xs text-muted-foreground">Reset module progress</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="section" className="cursor-pointer" >
                          <div className="flex items-center sm:gap-3 gap-1 py-3 sm:px-2">
                            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            <div>
                              <div className="font-semibold">Specific Section</div>
                              <div className="text-xs text-muted-foreground">Reset section progress</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="item" className="cursor-pointer" >
                          <div className="flex items-center sm:gap-3 gap-1 py-3 sm:px-2">
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
          {/* Move Cohort Modal */}
          {isMoveCohortModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">

              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setIsMoveCohortModalOpen(false)}
              />

              {/* Modal */}
              <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Move Students to Cohort</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMoveCohortModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Selection Controls */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {moveSelectedUsers.size} selected
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMoveSelectionMode(prev => !prev)}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    {isMoveSelectionMode ? "Hide" : "Select Students"}
                  </Button>
                </div>

                {/* Student Selection */}
                {isMoveSelectionMode && (
                  <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-2">

                    {/* Select All */}
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Checkbox
                        checked={
                          filteredStudentEnrollments
                            .filter((e: any) => !e.cohortId)
                            .every((e: any) => moveSelectedUsers.has(e.id))
                        }
                        onCheckedChange={(checked) =>
                          handleMoveSelectAll(checked === true)
                        }
                      />
                      <span className="text-sm font-medium">Select All</span>
                    </div>

                    {/* Students */}
                    {filteredStudentEnrollments
                      .filter((e: any) => !e.cohortId)
                      .map((enrollment: any) => {
                        const enrollmentId = enrollment.id;

                        return (
                          <div
                            key={enrollmentId}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/20"
                          >
                            <Checkbox
                              checked={moveSelectedUsers.has(enrollmentId)}
                              onCheckedChange={(checked) =>
                                handleMoveSelectUser(enrollment, checked === true)
                              }
                            />

                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {`${enrollment.user?.firstName || ""} ${enrollment.user?.lastName || ""}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {enrollment.user?.email}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Cohort Select */}
                <div className="space-y-2">
                  <Label>Select Target Cohort</Label>
                  <Select
                    value={selectedMoveCohort ?? ""}
                    onValueChange={(val) => setSelectedMoveCohort(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {(version as any)?.cohortDetails?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsMoveCohortModalOpen(false)}
                  >
                    Cancel
                  </Button>

                  <Button
                    disabled={
                      !selectedMoveCohort ||
                      moveSelectedUsers.size === 0 ||
                      moveToCohortMutation.isPending
                    }
                    onClick={handleMoveToCohort}
                  >
                    {moveToCohortMutation.isPending ? "Moving..." : "Move"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Unenroll Confirmation Dialog */}
          {isBulkUnenrollDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
                onClick={() => setIsBulkUnenrollDialogOpen(false)}
              />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl sm:max-w-lg max-[425px]:w-[90vw] w-full mx-4 sm:p-10 p-5 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-card-foreground">Bulk Unenroll</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsBulkUnenrollDialogOpen(false)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <p className="text-lg text-card-foreground">
                    Are you sure you want to unenroll <strong>{selectedUsers.size}</strong> students?
                  </p>
                  <div className="flex gap-4 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                    <div><AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" /></div>
                    <div className="text-sm text-red-800 dark:text-red-200">
                      <strong>Warning:</strong> This action cannot be undone. Selected students will lose access to the course version and all their progress data.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsBulkUnenrollDialogOpen(false)}
                    className="min-w-[100px] cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmBulkUnenroll}
                    className="min-w-[100px] shadow-lg cursor-pointer"
                  >
                    Unenroll Selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Disable Confirmation Dialog */}
          {isBulkDisableDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer" onClick={() => setIsBulkDisableDialogOpen(false)} />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl sm:max-w-lg max-[425px]:w-[90vw] w-full mx-4 sm:p-10 p-5 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-card-foreground">Disable Students</h2>
                  <Button variant="ghost" size="sm" onClick={() => setIsBulkDisableDialogOpen(false)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <p className="text-lg text-card-foreground">
                    Are you sure you want to disable <strong>{selectedUsers.size}</strong> students? They will be moved to the Inactive tab.
                  </p>
                  <div className="flex gap-4 p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div><AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" /></div>
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      Students will be set to inactive. You can re-enable them from the Inactive tab.
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsBulkDisableDialogOpen(false)} className="min-w-[100px] cursor-pointer">Cancel</Button>
                  <Button
                    onClick={confirmBulkDisable}
                    disabled={bulkChangeStatusMutation.isPending}
                    className="min-w-[130px] shadow-lg cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {bulkChangeStatusMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disabling...</> : 'Disable Selected'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Enable Confirmation Dialog */}
          {isBulkEnableDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center mb-0">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer" onClick={() => setIsBulkEnableDialogOpen(false)} />
              <div className="relative bg-card border border-border rounded-2xl shadow-2xl sm:max-w-lg max-[425px]:w-[90vw] w-full mx-4 sm:p-10 p-5 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-card-foreground">Enable Students</h2>
                  <Button variant="ghost" size="sm" onClick={() => setIsBulkEnableDialogOpen(false)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <p className="text-lg text-card-foreground">
                    Are you sure you want to re-enable <strong>{selectedInactiveUsers.size}</strong> students? They will be moved back to the Active tab.
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsBulkEnableDialogOpen(false)} className="min-w-[100px] cursor-pointer">Cancel</Button>
                  <Button
                    onClick={confirmBulkEnable}
                    disabled={bulkChangeStatusMutation.isPending}
                    className="min-w-[130px] shadow-lg cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                  >
                    {bulkChangeStatusMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enabling...</> : 'Enable Selected'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div >

      {/* Time Slots Modal */}
      {
        courseId && versionId && (
          <TimeSlotsModal
            isOpen={isTimeSlotsModalOpen}
            onClose={() => setIsTimeSlotsModalOpen(false)}
            courseId={courseId}
            courseVersionId={versionId}
          />
        )
      }
    </>
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
                <span className="flex-shrink-0">{getItemIcon(item.type)}</span>
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
}: {
  versionId: string
  moduleId: string
  sectionId: string
  selectedViewItem: string
  onItemSelect: (itemId: string, itemType: string, itemName: string) => void
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
          <span className="flex-shrink-0">{getItemIcon(item.type)}</span>
          <span className="text-sm text-foreground">{item.displayName}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {item.type}
          </Badge>
        </div>
      ))}
    </div>
  )
}


interface EnrollmentsTableProps {
  studentEnrollments: any[];
  enrollmentsLoading: boolean;
  isSearching: boolean;
  enrollmentTab: "ACTIVE" | "INACTIVE";
  searchQuery: string;
  limit: number;
  handleLimitChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleSort: (column: any) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  isLoadingQuizScores: boolean;
  setIsExporting: (exporting: boolean) => void;
  isExportingStudentContacts: boolean;
  setIsExportingStudentContacts: (exporting: boolean) => void;
  unenrollMutation: any;
  changeStatusMutation: any;
  bulkChangeStatusMutation: any;
  user: any;
  handleViewProgress: (user: any) => void;
  handleRemoveStudent: (user: any) => void;
  handleDisableStudent: (enrollment: any) => void;
  handleEnableStudent: (enrollment: any) => void;
  isSelectionMode: boolean;
  selectedUsers: Set<string>;
  onSelectUser: (userId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  toggleSelectionMode: () => void;
  handleBulkUnenroll: () => void;
  handleBulkDisable?: () => void;
  handleBulkEnable?: () => void;
  setIsTimeSlotsModalOpen: (open: boolean) => void;
  getStudentTimeSlot: (userId: string) => any;
  version: any;
  cohort: string | null;
  setCohort: (cohort: string | null) => void;
}

function EnrollmentsTable({
  studentEnrollments,
  enrollmentsLoading,
  isSearching,
  enrollmentTab,
  searchQuery,
  limit,
  handleLimitChange,
  handleSort,
  sortBy,
  sortOrder,
  isLoadingQuizScores,
  setIsExporting,
  isExportingStudentContacts,
  setIsExportingStudentContacts,
  unenrollMutation,
  changeStatusMutation,
  bulkChangeStatusMutation,
  user,
  handleViewProgress,
  handleRemoveStudent,
  handleDisableStudent,
  handleEnableStudent,
  isSelectionMode,
  selectedUsers,
  onSelectUser,
  onSelectAll,
  toggleSelectionMode,
  handleBulkUnenroll,
  handleBulkDisable,
  handleBulkEnable,
  setIsTimeSlotsModalOpen,
  getStudentTimeSlot,
  version,
  cohort,
  setCohort,
}: EnrollmentsTableProps) {
  const isInactiveTab = enrollmentTab === "INACTIVE"

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-card to-muted/20 flex items-center justify-between lg:flex-nowrap flex-wrap">
        <CardTitle className="text-xl font-medium text-card-foreground">
          {isInactiveTab
            ? `Inactive Students `
            : `Active Students `}
        </CardTitle>

        {/* SAME header functionality for both tabs */}
        <div className="flex items-center space-x-4 lg:flex-nowrap flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportingStudentContacts(true)}
            disabled={isExportingStudentContacts || enrollmentsLoading || isSearching}
            className="flex items-center gap-2"
          >
            {isExportingStudentContacts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{isExportingStudentContacts ? "Exporting..." : "Export Student Contacts"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExporting(true)}
            disabled={isLoadingQuizScores}
            className="flex items-center gap-2"
          >
            {isLoadingQuizScores ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span>{isLoadingQuizScores ? "Exporting..." : "Export Quiz Scores"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsTimeSlotsModalOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            <span>Configure Time Slots</span>
          </Button>

          {/* Select Students Button - shown in both tabs */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectionMode}
            className="flex items-center gap-2"
          >
            {isSelectionMode ? (
              <>
                <X className="h-4 w-4" />
                <span>Exit Selection</span>
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                <span>Select Students</span>
              </>
            )}
          </Button>

          {(version as any)?.cohortDetails?.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
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

          {/* Bulk Actions Bar - Active tab: Disable + Unenroll */}
          {isSelectionMode && selectedUsers.size > 0 && !isInactiveTab && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDisable}
                className="flex items-center gap-2 animate-in fade-in zoom-in duration-200 border-amber-400 text-amber-700 hover:bg-amber-50"
              >
                <UserX className="h-4 w-4" />
                <span>Disable ({selectedUsers.size})</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkUnenroll}
                className="flex items-center gap-2 animate-in fade-in zoom-in duration-200"
              >
                <Trash2 className="h-4 w-4" />
                <span>Remove</span>
              </Button>
            </>
          )}

          {/* Bulk Enable - Inactive tab */}
          {isSelectionMode && selectedUsers.size > 0 && isInactiveTab && (
            <Button
              size="sm"
              onClick={handleBulkEnable}
              className="flex items-center gap-2 animate-in fade-in zoom-in duration-200 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Enable ({selectedUsers.size})</span>
            </Button>
          )}

          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <select
              value={limit}
              onChange={handleLimitChange}
              className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-muted-foreground">per page</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {(enrollmentsLoading || isSearching) ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/30">
                  {/* Select All Checkbox */}
                  {isSelectionMode && (
                    <TableHead className="w-[50px] pl-6">
                      <Checkbox
                        checked={
                          studentEnrollments.length > 0 &&
                          studentEnrollments.every((e: any) => {
                            const studentId = e.user?._id || e.user?.id;
                            return selectedUsers.has(studentId);
                          })
                        }
                        onCheckedChange={onSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  {(() => {
                    const columns = isInactiveTab
                      ? [
                        { key: "name", label: "Student", className: "pl-6 w-[300px]" },
                        { key: "enrollmentDate", label: "Enrolled", className: "w-[120px]" },
                        { key: "unenrolledAt", label: "Unenrolled", className: "w-[120px]" },
                        { key: "progress", label: "Completion Percentage", className: "w-[200px]" },
                        { key: "assignedTimeSlot", label: "Assigned Time Slot", className: "w-[200px]" },
                      ]
                      : [
                        { key: "name", label: "Student", className: "pl-6 w-[300px]" },
                        { key: "enrollmentDate", label: "Enrolled", className: "w-[120px]" },
                        { key: "progress", label: "Completion Percentage", className: "w-[200px]" },
                        { key: "assignedTimeSlot", label: "Assigned Time Slot", className: "w-[200px]" },
                      ];
                    return columns.map(({ key, label, className }) => (
                      <TableHead
                        key={key}
                        className={`font-bold text-foreground cursor-pointer select-none ${className}`}
                        onClick={() => handleSort(key as "name" | "enrollmentDate" | "progress" | "unenrolledAt")}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {sortBy === key &&
                            (sortOrder === "asc" ? (
                              <ArrowUp size={16} className="text-foreground" />
                            ) : (
                              <ArrowDown size={16} className="text-foreground" />
                            ))}
                        </span>
                      </TableHead>
                    ));
                  })()}
                  <TableHead className="font-bold text-foreground pr-6 w-[300px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                <TableRow key="loading-initial">
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading enrollments...</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : studentEnrollments.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>

            <p className="text-foreground text-xl font-semibold mb-2">
              No {isInactiveTab ? "inactive" : "active"} students found
            </p>

            <p className="text-muted-foreground">
              {searchQuery ? "Try adjusting your search terms" : "No enrollments found"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">

            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/30">
                  {/* Select All Checkbox */}
                  {isSelectionMode && (
                    <TableHead className="w-[50px] pl-6 font-bold text-foreground">
                      <Checkbox
                        checked={
                          studentEnrollments.length > 0 &&
                          studentEnrollments.every((e: any) => {
                            const studentId = e.user?._id || e.user?.id;
                            return selectedUsers.has(studentId);
                          })
                        }
                        onCheckedChange={onSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  {(() => {
                    const columns = isInactiveTab
                      ? [
                        { key: "name", label: "Student", className: "pl-6 w-[300px]" },
                        { key: "enrollmentDate", label: "Enrolled", className: "w-[120px]" },
                        { key: "unenrolledAt", label: "Unenrolled", className: "w-[120px]" },
                        { key: "progress", label: "Completion Percentage", className: "w-[200px]" },
                        { key: "assignedTimeSlot", label: "Assigned Time Slot", className: "w-[200px]" },
                      ]
                      : [
                        { key: "name", label: "Student", className: "pl-6 w-[300px]" },
                        { key: "enrollmentDate", label: "Enrolled", className: "w-[120px]" },
                        { key: "progress", label: "Completion Percentage", className: "w-[200px]" },
                        { key: "assignedTimeSlot", label: "Assigned Time Slot", className: "w-[200px]" },
                      ];
                    return columns.map(({ key, label, className }) => (
                      <TableHead
                        key={key}
                        className={`font-bold text-foreground cursor-pointer select-none ${className}`}
                        onClick={() => handleSort(key as "name" | "enrollmentDate" | "progress" | "unenrolledAt")}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {sortBy === key &&
                            (sortOrder === "asc" ? (
                              <ArrowUp size={16} className="text-foreground" />
                            ) : (
                              <ArrowDown size={16} className="text-foreground" />
                            ))}
                        </span>
                      </TableHead>
                    ));
                  })()}
                  <TableHead className="font-bold text-foreground pr-6 w-[200px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {(enrollmentsLoading || isSearching) ? (
                  <TableRow key="loading-secondary">
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading enrollments...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : studentEnrollments.length === 0 ? (
                  <TableRow key="empty-state">
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex items-center justify-center">
                        <Users className="h-12 w-12 text-muted-foreground mb-4" />
                        <div>
                          <p className="text-foreground text-lg font-semibold mb-2">
                            No {isInactiveTab ? "inactive" : "active"} students found
                          </p>
                          <p className="text-muted-foreground">
                            {searchQuery ? "Try adjusting your search terms" : "No enrollments found"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  studentEnrollments.map((enrollment: any) => (
                    <TableRow
                      key={enrollment._id || `enrollment-${Math.random()}`}
                      className={`border-border hover:bg-muted/20 transition-colors duration-200 group ${isInactiveTab ? "opacity-80" : ""
                        }`}
                    >
                      {/* Selection Checkbox */}
                      {isSelectionMode && (
                        <TableCell className="pl-6 w-[50px]">
                          <Checkbox
                            checked={selectedUsers.has(enrollment.user?._id || enrollment.user?.id)}
                            onCheckedChange={(checked) =>
                              onSelectUser(enrollment.user?._id || enrollment.user?.id, checked === true)
                            }
                            aria-label={`Select ${enrollment.user?.name}`}
                          />
                        </TableCell>
                      )}

                      {/* Student */}
                      <TableCell className={isSelectionMode ? "pl-2 py-6" : "pl-6 py-6"}>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md group-hover:border-primary/40 transition-colors duration-200">
                            <AvatarImage src="/placeholder.svg" alt={enrollment?.user?.email || ""} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
                              <span>
                                {[enrollment?.user?.firstName, enrollment?.user?.lastName]
                                  .map(name => name?.trim()?.[0])
                                  .filter(Boolean)
                                  .map(ch => ch!.toUpperCase())
                                  .join("") || "?"}
                              </span>
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground truncate text-base md:text-lg">
                                {enrollment?.user?.firstName || enrollment?.user?.lastName
                                  ? `${enrollment?.user?.firstName ?? ""} ${enrollment?.user?.lastName ?? ""}`.trim()
                                  : "Unknown User"}
                              </p>
                            </div>

                            <p className="text-xs md:text-sm text-muted-foreground truncate">
                              {enrollment?.user?.email || ""}
                            </p>
                            {enrollment?.cohortName && (
                            <p className="text-xs md:text-sm text-muted-foreground truncate">
                              (Cohort- {enrollment?.cohortName || ""})
                            </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Enrolled Date */}
                      <TableCell className="py-6">
                        <div className="text-muted-foreground font-medium">
                          {new Date(enrollment.enrollmentDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </TableCell>

                      {/* Unenrolled Date - Only for Inactive */}
                      {isInactiveTab && (
                        <TableCell className="py-6">
                          <div className="text-muted-foreground font-medium">
                            {enrollment.unenrolledAt ? (
                              new Date(enrollment.unenrolledAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            ) : (
                              "N/A"
                            )}
                          </div>
                        </TableCell>
                      )}

                      {/* Progress */}
                      <TableCell className="py-6">
                        <EnrollmentProgress progress={Math.min(enrollment.progress ?? 0, 100)} />
                      </TableCell>

                      {/* Assigned Time Slot */}
                      <TableCell className="py-6">
                        <div className="text-muted-foreground font-medium">
                          {(() => {
                            const timeSlot = getStudentTimeSlot(enrollment.user?._id || enrollment.user?.id);
                            if (timeSlot && timeSlot.from && timeSlot.to) {
                              const formatTime = (time: string) => {
                                const [hour, minute] = time.split(':');
                                const h = parseInt(hour);
                                const suffix = h >= 12 ? 'PM' : 'AM';
                                const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
                                return `${displayHour}:${minute} ${suffix}`;
                              };
                              return `${formatTime(timeSlot.from)} - ${formatTime(timeSlot.to)}`;
                            }
                            return "Not Assigned";
                          })()}
                        </div>
                      </TableCell>


                      {/* Actions */}
                      <TableCell className="py-6 pr-6">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {/* View Progress - Always enabled in both tabs */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleViewProgress({
                                id: enrollment.user?._id,
                                name:
                                  `${enrollment?.user?.firstName || ""} ${enrollment?.user?.lastName || ""}`.trim() ||
                                  "Unknown User",
                                email: enrollment.user?.email,
                                enrolledDate: enrollment.enrollmentDate,
                                progress: enrollment.progress || 0,
                                completedItemsCount: enrollment.completedItemsCount || 0,

                                contentCounts: {
                                  totalItems: enrollment.contentCounts?.total || 0,
                                  videos: enrollment.contentCounts?.itemCounts?.VIDEO || 0,
                                  quizzes: enrollment.contentCounts?.itemCounts?.QUIZ || 0,
                                  articles: enrollment.contentCounts?.itemCounts?.BLOG || 0,
                                  projects: enrollment.contentCounts?.itemCounts?.PROJECT || 0,
                                  completedVideos: enrollment.contentCounts?.completedItemCounts?.VIDEO || 0,
                                  completedQuizzes: enrollment.contentCounts?.completedItemCounts?.QUIZ || 0,
                                  completedArticles: enrollment.contentCounts?.completedItemCounts?.BLOG || 0,
                                  completedProjects: enrollment.contentCounts?.completedItemCounts?.PROJECT || 0,
                                  totalQuizScore: enrollment.totalQuizScore || 0,
                                  totalQuizMaxScore: enrollment.totalQuizMaxScore || 0,
                                },
                                isDeleted: enrollment.isDeleted,
                                cohortId: enrollment.cohortId,
                                cohortName: enrollment.cohortName
                              })
                            }
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-200 cursor-pointer"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Progress
                          </Button>

                          {/* Disable button - Active tab only */}
                          {!isInactiveTab && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisableStudent(enrollment)}
                              disabled={changeStatusMutation.isPending || user?.email === enrollment?.user?.email}
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all duration-200 cursor-pointer"
                            >
                              {changeStatusMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4 mr-2" />
                              )}
                              Disable
                            </Button>
                          )}

                          {/* Enable button - Inactive tab only */}
                          {isInactiveTab && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEnableStudent(enrollment)}
                              disabled={changeStatusMutation.isPending}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30 transition-all duration-200 cursor-pointer"
                            >
                              {changeStatusMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              )}
                              Enable
                            </Button>
                          )}

                          {/* Remove - Active tab only */}
                          {!isInactiveTab && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                  {console.log("Remove student clicked:", enrollment);
                                handleRemoveStudent({
                                  id: enrollment.user?._id,
                                  name:
                                    `${enrollment?.user?.firstName || ""} ${enrollment?.user?.lastName || ""}`.trim() ||
                                    "Unknown User",
                                  email: enrollment.user?.email,
                                  enrolledDate: enrollment.enrollmentDate,
                                  progress: 0,
                                  cohortId: enrollment.cohortId,
                                  cohortName: enrollment.cohortName
                                })}
                              }
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 cursor-pointer"
                              disabled={
                                unenrollMutation.isPending ||
                                user?.email === enrollment?.user?.email ||
                                enrollment?.isDeleted
                              }
                            >
                              {unenrollMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4 mr-2" />
                              )}
                              Remove
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
