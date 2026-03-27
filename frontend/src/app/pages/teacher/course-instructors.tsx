"use client"

import { useState, useEffect } from "react"
import { Search, Users, UserX, X, Loader2, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useCourseById, useCourseVersionById, useCourseVersionEnrollments, useUnenrollUser } from "@/hooks/hooks"
import { useCourseStore } from "@/store/course-store"
import { useAuthStore } from "@/store/auth-store" 
import type { EnrolledUser } from "@/types/course.types"
import { useNavigate } from "@tanstack/react-router"
import { Pagination } from "@/components/ui/Pagination"
import CourseBackButton from "./CourseBackButton";

export default function CourseInstructors() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<'name' | 'enrollmentDate' | 'progress'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [userToRemove, setUserToRemove] = useState<EnrolledUser | null>(null)
  const unenrollMutation = useUnenrollUser()
  const navigate = useNavigate()
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const handleSort = (key: 'name' | 'enrollmentDate' | 'progress') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setCurrentPage(1);
  };


  const handleRemoveInstructor = (user: EnrolledUser) => {
    setUserToRemove(user)
    setIsRemoveDialogOpen(true)
  }

  const confirmRemoveInstructor = async () => {
    if (userToRemove && courseId && versionId) {
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
        refetchInstructors()
      } catch (error) {
        console.error("Failed to remove instructors:", error)
      }
    }
  }


  const getRoleBadge = (role: string) => {
    const roleConfig = {
      INSTRUCTOR: { bg: 'bg-blue-100 text-blue-800', label: 'Instructor' },
      ASSISTANT: { bg: 'bg-purple-100 text-purple-800', label: 'Assistant' },
      STUDENT: { bg: 'bg-green-100 text-green-800', label: 'Student' }
    };

    const config = roleConfig[role as keyof typeof roleConfig] || { bg: 'bg-gray-100 text-gray-800', label: role };
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${config.bg} font-medium`}>
        {config.label}
      </span>
    );
  };

  useEffect(() => {
    if (searchQuery !== debouncedSearch) {
      setIsSearching(true);
    }
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setIsSearching(false);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, debouncedSearch]);

  // Get course info from store and router
  const { currentCourse } = useCourseStore();
  const { user } = useAuthStore();
  const courseId = currentCourse?.courseId;
  const versionId = currentCourse?.versionId;

  // Fetch enrollments data - filter for instructors only
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
    refetch: refetchInstructors,
  } = useCourseVersionEnrollments(
    courseId,
    versionId,
    currentPage,
    limit,
    debouncedSearch,
    sortBy,
    sortOrder,
    !!(courseId && versionId),
    'OTHER'
  );

  const instructorEnrollments = enrollmentsData?.enrollments || [];
  // Handle errors
  useEffect(() => {
    if (enrollmentsError) {
      toast.error('Failed to load instructors');
      console.error('Error loading instructors:', enrollmentsError);
    }
  }, [enrollmentsError]);

  // Fetch course and version data
  const { data: course, error: courseError } = useCourseById(courseId || "")
  const { data: version, error: versionError } = useCourseVersionById(versionId || "")

  const totalDocuments = enrollmentsData?.totalDocuments || 0
  const totalPages = enrollmentsData?.totalPages || 1
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };
  // Error state
  if (courseError || versionError || (enrollmentsError && !debouncedSearch && !searchQuery) || !course || !version) {
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 space-y-8">
        {/* <CourseBackButton /> */}
        <div className="flex flex-col space-y-4">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Course Instructors</h1>
            </div>
          </div>
        </div>
        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search instructors by user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 border-border bg-card text-card-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
            <X className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSearchQuery("");
              }} />
          </div>
        </div>

        {/* Instructors Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-r from-card to-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-medium text-card-foreground">Instructors</CardTitle>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Show</span>
                <select
                  value={limit}
                  onChange={handleLimitChange}
                  className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm text-muted-foreground whitespace-nowrap">per page</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    {[
                      { key: 'name', label: 'Instructor', className: 'pl-6 w-[300px]' },
                      { key: 'enrollmentDate', label: 'Enrolled', className: 'w-[120px]' },
                    ].map(({ key, label, className }) => (
                      <TableHead
                        key={key}
                        className={`font-bold text-foreground cursor-pointer select-none ${className}`}
                        onClick={() => handleSort(key as 'name' | 'enrollmentDate' | 'progress')}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {sortBy === key &&
                            (sortOrder === 'asc' ? (
                              <ArrowUp size={16} className="text-foreground" />
                            ) : (
                              <ArrowDown size={16} className="text-foreground" />
                            ))}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="font-bold text-foreground pr-6 w-[200px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {(enrollmentsLoading || isSearching) ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16">
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-muted-foreground">
                            Loading Instructors...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : instructorEnrollments?.length > 0 ? (
                    instructorEnrollments.map((instructor: any) => (
                      <TableRow
                        key={instructor._id}
                        className={`border-border hover:bg-muted/20 transition-colors duration-200 group ${instructor.isDeleted ? 'opacity-10' : ''}`}
                      >
                        <TableCell className="pl-6 py-6">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md group-hover:border-primary/40 transition-colors duration-200">
                              <AvatarImage
                                src={instructor.user.avatar}
                                alt={`${instructor.user.firstName} ${instructor.user.lastName}`}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
                                {[instructor.user.firstName?.[0], instructor.user.lastName?.[0]]
                                  .filter(Boolean)
                                  .map((ch: string) => ch.toUpperCase())
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground truncate text-base md:text-lg">
                                  {`${instructor.user.firstName} ${instructor.user.lastName}`}
                                </p>
                                <span>{getRoleBadge(instructor.role)}</span>
                              </div>
                              <p className="text-xs md:text-sm text-muted-foreground truncate">
                                {instructor.user.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="text-muted-foreground font-medium">
                            {new Date(instructor.enrollmentDate).toLocaleDateString("en-US", {
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
                                handleRemoveInstructor({
                                  id: instructor.user?._id,
                                  name:
                                    `${instructor?.user?.firstName || ""} ${instructor?.user?.lastName || ""}`.trim() ||
                                    "Unknown User",
                                  email: instructor.user?.email,
                                  enrolledDate: instructor.enrollmentDate,
                                  progress: 0,
                                })
                              }
                              disabled={
                                instructor.user?.firebaseUID === user?.uid
                              }
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 cursor-pointer"
                              title="Remove instructor"
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-foreground font-medium">No instructors found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

        </Card>
        {/* Enhanced Remove Instructor Confirmation Modal */}
        {isRemoveDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
              onClick={() => setIsRemoveDialogOpen(false)}
            />
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full mx-4 sm:p-10 p-5 space-y-8 animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
              <div className="flex items-center justify-between">
                <h2 className="sm:text-2xl text-xl font-bold text-card-foreground">Remove Instructor</h2>
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
                    <strong>Warning:</strong> This action cannot be undone. The instructor will lose access to this course version.
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
                  onClick={confirmRemoveInstructor}
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
