import { useState, useMemo, useEffect } from "react";
import { Search, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "@tanstack/react-router";
import { useUserEnrollments, usePublicCourses } from "@/hooks/hooks";
import { useAuthStore } from "@/store/auth-store";

// Import new components
import { CourseCard } from "@/components/course/CourseCard";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { stopAllStreams} from "@/lib/MediaRegistry";

export default function StudentCourses() {
  useEffect(() => {
    setTimeout(stopAllStreams, 1000);
  }, []);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("enrolled");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery !== debouncedSearch) {
      setIsSearching(true);
    }
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setIsSearching(false);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Get the current user from auth store
  const { isAuthenticated, token } = useAuthStore();
  
  const { data: enrollmentsData, isLoading, error, refetch, isRefetching } = useUserEnrollments(
    currentPage, 10, !!token, debouncedSearch
  );

  const { data: publicCoursesData, isLoading: loadingPublic, refetch: refetchPublic, isRefetching: isRefetchingPublic } = usePublicCourses(
    currentPage,
    10,
    !!token,
    debouncedSearch
  );

  const enrollments = enrollmentsData?.enrollments || [];
  const totalPages = enrollmentsData?.totalPages || 1;
  // const currentPageFromAPI = enrollmentsData?.currentPage || 1;
  const totalDocuments = enrollmentsData?.totalDocuments || 0;
  // Filter enrollments based on completion status
  const activeEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => 
      enrollment.percentCompleted !== 100  ||   
      enrollment.hasNewItemsAfterCompletion === true)
   ;
  }, [enrollments]);

  const completedEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => 
      enrollment.percentCompleted === 100 && 
      !enrollment.hasNewItemsAfterCompletion);
  }, [enrollments]);

  // Update current page when API response changes
  // useEffect(() => {
  //   if (currentPageFromAPI !== currentPage) {
  //     setCurrentPage(currentPageFromAPI);
  //   }
  // }, [currentPageFromAPI, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setCurrentPage(1); // Reset to first page when changing tabs
  };

  const renderEnrollmentCard = (enrollment: any, index: number, isLoading: boolean) => {
    return <CourseCard enrollment={enrollment} index={index} isLoading={isLoading} variant="dashboard" />;
  };

  // Add authentication check at the beginning of the render
  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <EmptyState
          title="Authentication Required"
          description="Please log in to view your courses"
          actionText="Go to Login"
          onAction={() => window.location.href = '/auth'}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <EmptyState
          title="Error loading courses"
          description={typeof error === 'string' ? error : "Failed to load your courses"}
          actionText="Try Again"
          onAction={() => refetch()}
          variant="error"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:px-4 px-0 p-4 pt-0">
      <div className="flex flex-col space-y-6">
        <section className="flex items-start justify-between gap-4">
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
            <p className="text-muted-foreground">Manage your learning journey</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeTab === "available" ? refetchPublic() : refetch()}
            disabled={activeTab === "available" ? isRefetchingPublic : isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(activeTab === "available" ? isRefetchingPublic : isRefetching) ? "animate-spin" : ""}`} />
            {(activeTab === "available" ? isRefetchingPublic : isRefetching) ? "Refreshing..." : "Refresh"}
          </Button>
        </section>
         
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <div className="flex md:flex-row flex-col items-center justify-between gap-2">
            <div className="relative flex-1 md:max-w-md w-full">
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
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground">
                <X className="h-4 w-4 cursor-pointer" onClick={() => setSearchQuery('')} />
              </div>
            </div>
            <TabsList className="md:w-fit w-full">
              <TabsTrigger value="enrolled" className="cursor-pointer">
                Enrolled ({isLoading ? "..." : totalDocuments})
              </TabsTrigger>
              <TabsTrigger value="available" className="cursor-pointer">
                Available ({loadingPublic ? "..." : (publicCoursesData?.totalDocuments || 0)})
              </TabsTrigger>
              <TabsTrigger value="completed" className="cursor-pointer">
                Completed ({isLoading ? "..." : completedEnrollments.length})
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="enrolled" className="space-y-4">
            {isLoading || isSearching ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3 mb-4" />
                      <div className="h-2 bg-muted rounded animate-pulse mb-4" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : activeEnrollments.length > 0 ? (
              <>
                <div className="space-y-2">
                  {activeEnrollments.map((enrollment, index) =>
                    renderEnrollmentCard(enrollment, index, isLoading)
                  )}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalDocuments={totalDocuments}
                  onPageChange={handlePageChange}
                />
              </>
            ) : (
              <EmptyState
                title="No enrolled courses"
                description="Start your learning journey by enrolling in a course"
                actionText="Browse Available Courses"
                onAction={() => setActiveTab("available")}
              />
            )}
          </TabsContent>
          <TabsContent value="available" className="space-y-4">
            {loadingPublic || isSearching ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3 mb-4" />
                      <div className="h-2 bg-muted rounded animate-pulse mb-4" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : publicCoursesData?.courses && publicCoursesData.courses.length > 0 ? (
              <>
                <div className="space-y-4">
                  {publicCoursesData.courses.map((course: any, index: number) => (
                    <CourseCard
                      key={index}
                      index={index}
                      isLoading={loadingPublic}
                      variant="available"
                      enrollment={{
                        courseId: course.courseId,
                        courseVersionId: course.courseVersionId,
                        course: {
                          name: course.courseName,
                          description: course.courseDescription
                        },
                        cohortId: course.cohortId,
                        cohortName: course.cohortName,
                      }}
                    />
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={publicCoursesData.totalPages}
                  totalDocuments={publicCoursesData.totalDocuments}
                  onPageChange={handlePageChange}
                />
              </>
            ) : (
              <EmptyState
                title="No public courses available"
                description="There are currently no public courses to enroll in"
                actionText="Refresh"
                onAction={() => refetchPublic()}
              />
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3 mb-4" />
                      <div className="h-2 bg-muted rounded animate-pulse mb-4" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : completedEnrollments.length > 0 ? (
              <div className="space-y-2">
                {completedEnrollments.map((enrollment, index) =>
                  renderEnrollmentCard(enrollment, index, isLoading)
                )}
              </div>
            ) : (
              <EmptyState
                title="No completed courses yet"
                description="Complete your first course to see it here"
                actionText="View Enrolled Courses"
                onAction={() => setActiveTab("enrolled")}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}