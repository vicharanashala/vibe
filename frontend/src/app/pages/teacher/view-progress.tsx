"use client"

import { useState, useEffect } from "react"
import {
  Search,
  Users,
  TrendingUp,
  CheckCircle,
  BookOpen,
  FileText,
  List,
  Play,
  BarChart3,
  X,
  Loader2,
  Eye,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

// Import hooks
import {
  useCourseById,
  useCourseVersionById,
  useItemsBySectionId,
  useCourseVersionEnrollments,
  useWatchTimeByItemId,
} from "@/hooks/hooks"

import { useCourseStore } from "@/store/course-store"
import type { EnrolledUser } from "@/types/course.types"

export default function ViewProgress() {
  
  // Get course info from store
  const { currentCourse } = useCourseStore()
  const courseId = currentCourse?.courseId
  const versionId = currentCourse?.versionId

  // Fetch course and version data
  const { data: course, isLoading: courseLoading, error: courseError } = useCourseById(courseId || "")
  const { data: version, isLoading: versionLoading, error: versionError } = useCourseVersionById(versionId || "")

  const [selectedUser, setSelectedUser] = useState<EnrolledUser | null>(null)
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [progressScope, setProgressScope] = useState<"course" | "module" | "section" | "item">("course")
  const [selectedModule, setSelectedModule] = useState<string>("")
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedItem, setSelectedItem] = useState<string>("")

  // Get userId from localStorage
  useEffect(() => {
    const userId = localStorage.getItem('userId') || localStorage.getItem('currentUserId') || ''
    // Store for potential future use
    console.log('Current user ID:', userId)
  }, [])

  // Fetch enrollments data
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
  } = useCourseVersionEnrollments(courseId || "", versionId || "", 1, 100, !!(courseId && versionId))

  // Show all enrollments regardless of role or status
  const studentEnrollments = enrollmentsData?.enrollments || []

  const filteredUsers = studentEnrollments.filter(
    (enrollment: any) =>
      enrollment &&
      ( enrollment?.userID?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        enrollment?.user?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       enrollment?.user?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       enrollment?.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (enrollment?.user?.firstName + " " + enrollment?.user?.lastName).toLowerCase().includes(searchQuery.toLowerCase()))
  )

  useEffect(() => {
    if (isProgressDialogOpen) {
      setProgressScope("course")
      setSelectedModule("")
      setSelectedSection("")  
      setSelectedItem("")
    }
  }, [isProgressDialogOpen])

  const handleViewProgress = (user: EnrolledUser) => {
    setSelectedUser(user)
    setIsProgressDialogOpen(true)
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
    switch (progressScope) {
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

  // Stats calculations based on current enrolled students
  const totalUsers = studentEnrollments.length
  // For now, we don't have progress data, so set completed users to 0
  const completedUsers = 0
  const averageProgress = 0

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
  if (courseLoading || versionLoading || enrollmentsLoading) {
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
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Student Progress</h1>
              <p className="text-lg text-muted-foreground">
                View and track student progress in {course.name} ({version.version})
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="relative overflow-hidden border-border bg-card transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor} ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Student List */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-card-foreground">Student Progress</CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-border bg-background text-foreground"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No students found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "No students match your search criteria." : "No students enrolled in this course yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="pl-6 py-4 text-left font-bold text-foreground">Student</TableHead>
                      <TableHead className="py-4 text-left font-bold text-foreground">Enrolled Date</TableHead>
                      <TableHead className="py-4 text-left font-bold text-foreground">Overall Progress</TableHead>
                      <TableHead className="py-4 text-right font-bold text-foreground pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((enrollment: any, index: number) => (
                      <TableRow
                        key={enrollment._id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors duration-200"
                      >
                        <TableCell className="pl-6 py-6">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border-2 border-border shadow-sm">
                              <AvatarImage src={enrollment.user?.avatar || "/placeholder.svg"} alt={enrollment.user?.firstName || "User"} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold text-sm">
                                {(enrollment.user?.firstName?.[0] || "") + (enrollment.user?.lastName?.[0] || "")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate">
                                {enrollment.user?.firstName && enrollment.user?.lastName
                                  ? `${enrollment.user.firstName} ${enrollment.user.lastName}`
                                  : `User ${enrollment.userId}`}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {enrollment.user?.email || enrollment.userId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <span className="text-sm text-foreground">
                            {enrollment.enrollmentDate ? new Date(enrollment.enrollmentDate).toLocaleDateString() : "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="flex items-center gap-4 w-40">
                            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden shadow-inner">
                              <div className="h-full rounded-full bg-gradient-to-r from-gray-400 to-gray-500 w-0" />
                            </div>
                            <span className="text-sm font-bold text-foreground min-w-[3rem] text-right">0%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-6 pr-6">
                          <div className="flex items-center gap-3 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleViewProgress({
                                  id: enrollment._id,
                                  name: enrollment.user?.firstName && enrollment.user?.lastName
                                    ? `${enrollment.user.firstName} ${enrollment.user.lastName}`
                                    : `User ${enrollment.userId}`,
                                  email: enrollment.userId, // Store userId in email field for our use
                                  enrolledDate: enrollment.enrollmentDate,
                                  progress: 0,
                                })
                              }
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-200 cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Progress
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
        {isProgressDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Enhanced Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
              onClick={() => setIsProgressDialogOpen(false)}
            />

            {/* Enhanced Modal */}
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-card-foreground">Student Progress Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsProgressDialogOpen(false)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Enhanced Student Info */}
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
                View detailed progress for this student in{" "}
                <strong>
                  {course.name} ({version.version})
                </strong>
                . Select the scope to see specific progress data.
              </p>

              {/* Enhanced Form Content */}
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="progress-scope" className="text-sm font-bold text-foreground">
                    Progress Scope
                  </Label>
                  <Select value={progressScope} onValueChange={(value: any) => setProgressScope(value)}>
                    <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
                      <SelectValue placeholder="Select progress scope" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border cursor-pointer">
                      <SelectItem value="course" className="cursor-pointer">
                        <div className="flex items-center gap-3 py-3 px-2">
                          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <div>
                            <div className="font-semibold">Entire Course Version</div>
                            <div className="text-xs text-muted-foreground">View overall course progress</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="module" className="cursor-pointer">
                        <div className="flex items-center gap-3 py-3 px-2">
                          <List className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <div className="font-semibold">Specific Module</div>
                            <div className="text-xs text-muted-foreground">View module progress</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="section" className="cursor-pointer">
                        <div className="flex items-center gap-3 py-3 px-2">
                          <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <div className="font-semibold">Specific Section</div>
                            <div className="text-xs text-muted-foreground">View section progress</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="item" className="cursor-pointer">
                        <div className="flex items-center gap-3 py-3 px-2">
                          <Play className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <div>
                            <div className="font-semibold">Specific Item</div>
                            <div className="text-xs text-muted-foreground">View individual item progress</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(progressScope === "module" || progressScope === "section" || progressScope === "item") && (
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

                {(progressScope === "section" || progressScope === "item") && selectedModule && (
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

                {progressScope === "item" && selectedModule && selectedSection && (
                  <ItemProgressSelector
                    versionId={versionId!}
                    moduleId={selectedModule}
                    sectionId={selectedSection}
                    selectedItem={selectedItem}
                    onItemChange={setSelectedItem}
                    userId={selectedUser?.email || ""} // userId is stored in email field
                  />
                )}

                {/* Progress Display Area */}
                {isFormValid() && selectedUser && (
                  <ProgressDisplay
                    scope={progressScope}
                    userId={selectedUser.email} // userId is stored in email field
                    courseId={courseId!}
                    versionId={versionId!}
                    moduleId={selectedModule}
                    sectionId={selectedSection}
                    itemId={selectedItem}
                    course={course}
                    version={version}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Component to handle item selection with API call
function ItemProgressSelector({
  versionId,
  moduleId,
  sectionId,
  selectedItem,
  onItemChange,
  userId,
}: {
  versionId: string
  moduleId: string
  sectionId: string
  selectedItem: string
  onItemChange: (itemId: string) => void
  userId: string
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
          {itemsResponse.map((item: any) => (
            <SelectItem key={item._id} value={item._id} className="cursor-pointer">
              <div className="flex items-center gap-3 py-2">
                <span className="text-lg">{getItemIcon(item.type)}</span>
                <div>
                  <div className="font-semibold">{item.name}</div>
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

// Component to display progress data based on scope
function ProgressDisplay({
  scope,
  userId,
  courseId,
  versionId,
  moduleId,
  sectionId,
  itemId,
  course,
  version,
}: {
  scope: "course" | "module" | "section" | "item"
  userId: string
  courseId: string
  versionId: string
  moduleId?: string
  sectionId?: string
  itemId?: string
  course: any
  version: any
}) {
  // For item scope, fetch watch time data
  const { data: watchTimeData, isLoading: watchTimeLoading, error: watchTimeError } = useWatchTimeByItemId(
    userId,
    itemId || "",
    // Only enabled for item scope
    scope === "item" && !!userId && !!itemId
  )

  if (scope === "item" && watchTimeLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Item Progress Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading progress data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (scope === "item" && watchTimeError) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Item Progress Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 text-sm text-destructive">
            Error loading progress data: {watchTimeError}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Progress Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {scope === "course" && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Course Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Overall Progress</span>
                <span className="text-sm font-medium">0%</span>
              </div>
              <Progress value={0} className="w-full" />
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">0</div>
                  <div className="text-xs text-muted-foreground">Modules Completed</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">0</div>
                  <div className="text-xs text-muted-foreground">Total Watch Time</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {scope === "module" && moduleId && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Module Progress</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Module Completion</span>
                <span className="text-sm font-medium">0%</span>
              </div>
              <Progress value={0} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Progress data for specific modules is not yet available. Please check back later.
              </p>
            </div>
          </div>
        )}

        {scope === "section" && moduleId && sectionId && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Section Progress</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Section Completion</span>
                <span className="text-sm font-medium">0%</span>
              </div>
              <Progress value={0} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Progress data for specific sections is not yet available. Please check back later.
              </p>
            </div>
          </div>
        )}

        {scope === "item" && itemId && watchTimeData && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Item Watch Time</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {Math.round((watchTimeData.watchedDuration || 0) / 60)}m
                  </div>
                  <div className="text-xs text-muted-foreground">Watched</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {Math.round((watchTimeData.totalDuration || 0) / 60)}m
                  </div>
                  <div className="text-xs text-muted-foreground">Total Duration</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Watch Progress</span>
                  <span className="text-sm font-medium">{Math.round(watchTimeData.progressPercentage || 0)}%</span>
                </div>
                <Progress value={watchTimeData.progressPercentage || 0} className="w-full" />
              </div>
            </div>
          </div>
        )}

        {scope === "item" && itemId && !watchTimeData && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Item Progress</h3>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No watch time data available for this item. The student may not have started watching yet.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Watch Progress</span>
                <span className="text-sm font-medium">0%</span>
              </div>
              <Progress value={0} className="w-full" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}