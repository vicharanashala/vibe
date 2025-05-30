import { useState, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserEnrollments, useCourseById } from "@/lib/api/hooks";
import { useAuthStore } from "@/lib/store/auth-store";
import { useCourseStore } from "@/lib/store/course-store";
import { useNavigate } from "@tanstack/react-router";  // Add TanStack Router import
import { components } from "@/lib/api/schema";

// const ITEMS_PER_PAGE = 6;

export default function StudentCourses() {
  const [activeTab, setActiveTab] = useState("enrolled");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Get the current user from auth store
  const { user, isAuthenticated } = useAuthStore();
  const userId = user?.uid;
  
  const { data: enrollmentsData, isLoading, error, refetch } = useUserEnrollments(
    userId || "",
    currentPage, 
    // ITEMS_PER_PAGE
  );

  const enrollments = enrollmentsData?.enrollments || [];
  const totalPages = enrollmentsData?.totalPages || 1;
  const currentPageFromAPI = enrollmentsData?.currentPage || 1;
  const totalDocuments = enrollmentsData?.totalDocuments || 0;

  // Update current page when API response changes
  useEffect(() => {
    if (currentPageFromAPI !== currentPage) {
      setCurrentPage(currentPageFromAPI);
    }
  }, [currentPageFromAPI]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-muted-foreground">
          Showing page {currentPage} of {totalPages} ({totalDocuments} total courses)
        </p>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          {/* Page numbers */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, currentPage - 2) + i;
            if (pageNum > totalPages) return null;
            
            return (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Add a component to fetch and display course details
  const CourseCard = ({ enrollment, index }: { enrollment: any, index: number }) => {
    const courseId = enrollment.courseId || enrollment._id;
    const { data: courseDetails, isLoading: isCourseLoading } = useCourseById(courseId);
    const { setCurrentCourse } = useCourseStore();
    const navigate = useNavigate();  // Add this line to use TanStack Router
    
    // Mock progress data - replace with actual progress from enrollment
    const progress = Math.floor(Math.random() * 100);
    
    if (isCourseLoading) {
      return (
        <Card>
          <CardHeader>
            <div className="h-4 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
          </CardHeader>
          <CardContent>
            <div className="h-2 bg-muted rounded animate-pulse mb-4" />
            <div className="h-10 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card key={courseId || index}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                {courseDetails?.name || enrollment.name || `Course ${index + 1}`}
              </CardTitle>
              <CardDescription>
                by {courseDetails?.instructors || enrollment.instructors || "Unknown Instructor"}
              </CardDescription>
            </div>
            <Badge variant="outline">{progress}% complete</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {courseDetails?.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {courseDetails.description}
            </p>
          )}
          <Progress value={progress} />
          <Button 
            className="w-full"
            onClick={() => {
              // Extract both courseId and versionId from enrollment
              const versionId = enrollment.courseVersionId || enrollment.versionId || "";
              
              console.log("Setting course store:", {
                courseId: courseId,
                versionId: versionId
              });
              
              // Pass both courseId and versionId to the store
              setCurrentCourse({
                courseId: courseId,
                versionId: versionId
              });
              
              navigate({ to: "/student/learn" });
            }}
          >
            Continue Learning
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderEnrollmentCard = (enrollment: components["schemas"]["CourseDataResponse"], index: number) => {
    return <CourseCard enrollment={enrollment} index={index} />;
  };

  // Add authentication check at the beginning of the render
  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
            <p className="text-muted-foreground text-center mb-4">
              Please log in to view your courses
            </p>
            <Button onClick={() => window.location.href = '/auth'}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <h3 className="text-lg font-medium mb-2">Loading User Data</h3>
            <p className="text-muted-foreground text-center">
              Please wait while we load your information...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <h3 className="text-lg font-medium mb-2">Error loading courses</h3>
            <p className="text-muted-foreground text-center mb-4">
              {typeof error === 'string' ? error : error || "Failed to load your courses"}
            </p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col space-y-6">
        <section className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground">Manage your learning journey</p>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="enrolled">
              Enrolled ({isLoading ? "..." : totalDocuments})
            </TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="enrolled" className="space-y-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-2 bg-muted rounded animate-pulse mb-4" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : enrollments.length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {enrollments.map((enrollment, index) => 
                    renderEnrollmentCard(enrollment, index)
                  )}
                </div>
                {renderPagination()}
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No enrolled courses</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Start your learning journey by enrolling in a course
                  </p>
                  <Button onClick={() => setActiveTab("available")}>
                    Browse Available Courses
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Available courses coming soon</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Browse and enroll in new courses
                </p>
                <Button variant="outline">Coming Soon</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No completed courses yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Complete your first course to see it here
                </p>
                <Button variant="outline" onClick={() => setActiveTab("enrolled")}>
                  View Enrolled Courses
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
