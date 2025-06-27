"use client"

import { useState, useEffect } from "react"
import { useSearch } from "@tanstack/react-router"
import {
  Search,
  Users,
  TrendingUp,
  CheckCircle,
  RotateCcw,
  UserX,
  BookOpen,
  FileText,
  List,
  Play,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

// Import hooks
import {
  useCourseById,
  useCourseVersionById,
  useItemsBySectionId,
  useCourseVersionEnrollments,
  useResetProgress,
} from "@/hooks/hooks"

import type { EnrolledUser, EnrollmentsSearchParams, ResetProgressData } from "@/types/course.types"
import { ErrorBar } from "recharts"

export default function CourseEnrollments() {
  // Get search params using TanStack Router
  const search = useSearch({ from: "/teacher/courses/enrollments" }) as EnrollmentsSearchParams
  const courseId = search?.courseId
  const versionId = search?.versionId

  // Fetch course and version data
  const { data: course, isLoading: courseLoading, error: courseError } = useCourseById(courseId || "")
  const {
    data: version,
    isLoading: versionLoading,
    error: versionError,
  } = useCourseVersionById(versionId || "")

  const [selectedUser, setSelectedUser] = useState<EnrolledUser | null>(null)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [userToRemove, setUserToRemove] = useState<EnrolledUser | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [resetScope, setResetScope] = useState<"course" | "module" | "section" | "item">("course")
  const [selectedModule, setSelectedModule] = useState<string>("")
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedItem, setSelectedItem] = useState<string>("")

  // Fetch enrollments data
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
    refetch: refetchEnrollments,
  } = useCourseVersionEnrollments(courseId, versionId, 1, 100, !!(courseId && versionId))

  // API Hooks
  const resetProgressMutation = useResetProgress()

  // Show all enrollments regardless of role or status
  const studentEnrollments = enrollmentsData?.enrollments || []

  const filteredUsers = studentEnrollments.filter((enrollment: any) =>
    enrollment.user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) + 
    enrollment.user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) +
    enrollment.user.email.toLowerCase().includes(searchQuery.toLowerCase()) +
    (enrollment.user.firstName+ " " + enrollment.user.lastName).toLowerCase().includes(searchQuery.toLowerCase())
  )
  console.log("Filtered Users:", filteredUsers)

  useEffect(() => {
    if (isResetDialogOpen) {
      setResetScope("course")
      setSelectedModule("")
      setSelectedSection("")
      setSelectedItem("")
    }
  }, [isResetDialogOpen])

  const handleResetProgress = (user: EnrolledUser) => {
    setSelectedUser(user)
    setIsResetDialogOpen(true)
  }

  const handleRemoveStudent = (user: EnrolledUser) => {
    setUserToRemove(user)
    setIsRemoveDialogOpen(true)
  }

  const confirmRemoveStudent = () => {
    if (userToRemove) {
      // TODO: Implement API call to remove student from course version
      console.log("Removing student:", userToRemove)
      setIsRemoveDialogOpen(false)
      setUserToRemove(null)
      // Refetch enrollments after removal
      refetchEnrollments()
    }
  }

  const handleConfirmReset = async () => {
    if (!selectedUser || !courseId || !versionId) return

    try {
      // Extract userId from the selected user (it's stored in the email field for our case)
      const userId = selectedUser.email // This contains the actual userId

      // Prepare the request body based on the selected scope
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
      // For course scope, we send an empty body

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

      console.log("Progress reset successfully")
      setIsResetDialogOpen(false)
      setSelectedUser(null)
      // Refetch enrollments after reset
      refetchEnrollments()
    } catch (error) {
      console.error("Failed to reset progress:", error)
      // You might want to show an error toast here
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
        {/* Enhanced Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Course Enrollments
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
          <div className="flex items-center gap-3">
            <Button className="gap-2 bg-primary hover:bg-accent text-primary-foreground cursor-pointer">
              Add Student
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
            <CardTitle className="text-xl font-bold text-card-foreground">Enrolled Students</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
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
                      <TableHead className="font-bold text-foreground pl-6 w-[300px]">Student</TableHead>
                      <TableHead className="font-bold text-foreground w-[120px]">Enrolled</TableHead>
                      <TableHead className="font-bold text-foreground w-[200px]">Progress</TableHead>
                      <TableHead className="font-bold text-foreground pr-6 w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((enrollment, index) => (
                      <TableRow
                        key={enrollment._id}
                        className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                      >
                        <TableCell className="pl-6 py-6">
                          <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md group-hover:border-primary/40 transition-colors duration-200">
                            <AvatarImage src="/placeholder.svg" alt={enrollment.userId} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
                            {enrollment.user.firstName[0].toUpperCase() + enrollment.user.lastName[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-foreground truncate text-lg">{enrollment.user.firstName +' '+ enrollment.user.lastName}</p>
                            <p className="text-sm text-muted-foreground truncate">{enrollment.user.email}</p>
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
                          <div className="flex items-center gap-4 w-40">
                            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden shadow-inner">
                              <div className="h-full rounded-full bg-gradient-to-r from-gray-400 to-gray-500 w-0" />
                            </div>
                            <span className="text-sm font-bold text-foreground min-w-[3rem] text-right">0%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-6 pr-6">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleResetProgress({
                                  id: enrollment._id,
                                  name: `User ${enrollment.userId}`,
                                  email: enrollment.userId, // Store userId in email field for our use
                                  enrolledDate: enrollment.enrollmentDate,
                                  progress: 0,
                                })
                              }
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all duration-200 cursor-pointer"
                              disabled={resetProgressMutation.isPending}
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
                                  id: enrollment._id,
                                  name: `User ${enrollment.userId}`,
                                  email: enrollment.userId,
                                  enrolledDate: enrollment.enrollmentDate,
                                  progress: 0,
                                })
                              }
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 cursor-pointer"
                            >
                              <UserX className="h-4 w-4 mr-2" />
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

        {/* Enhanced Remove Student Confirmation Modal */}
        {isRemoveDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Enhanced Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
              onClick={() => setIsRemoveDialogOpen(false)}
            />

            {/* Enhanced Modal */}
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-10 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
              {/* Header */}
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

              {/* Content */}
              <div className="space-y-8">
                <p className="text-lg text-card-foreground">
                  Want to remove <strong className="text-primary">{userToRemove?.name}</strong> from{" "}
                  <strong className="text-primary">
                    {course.name} ({version.version})
                  </strong>
                  ?
                </p>

                {/* Enhanced Warning Alert */}
                <div className="flex gap-4 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <strong>Warning:</strong> This action cannot be undone. The student will lose access to the course
                    version and all their progress data.
                  </div>
                </div>
              </div>

              {/* Footer */}
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
                  className="min-w-[100px] shadow-lg cursor-pointer"
                >
                  Yes, Remove
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Reset Progress Modal */}
        {isResetDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Enhanced Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
              onClick={() => setIsResetDialogOpen(false)}
            />

            {/* Enhanced Modal */}
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full mx-4 p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
              {/* Header */}
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
                Choose the scope of progress reset for this student in{" "}
                <strong>
                  {course.name} ({version.version})
                </strong>
                . This action cannot be undone.
              </p>

              {/* Enhanced Form Content */}
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
                      <SelectItem value="module" className="cursor-pointer">
                        <div className="flex items-center gap-3 py-3 px-2">
                          <List className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <div className="font-semibold">Specific Module</div>
                            <div className="text-xs text-muted-foreground">Reset module progress</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="section" className="cursor-pointer">
                        <div className="flex items-center gap-3 py-3 px-2">
                          <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <div className="font-semibold">Specific Section</div>
                            <div className="text-xs text-muted-foreground">Reset section progress</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="item" className="cursor-pointer">
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

                {/* Enhanced Warning Alert */}
                <div className="flex gap-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> This action cannot be undone. The student's progress will be permanently
                    reset for the selected scope.
                  </div>
                </div>
              </div>

              {/* Footer */}
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
