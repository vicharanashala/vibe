import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUserEnrollments, useWatchtimeTotal, usePublicCourses } from "@/hooks/hooks";
import { useNavigate } from "@tanstack/react-router";

// Import components
import { StatCard } from "@/components/ui/StatCard";
import { CourseSection } from "@/components/course/CourseSection";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGreeting } from "@/utils/helpers";
import type { CoursePctCompletion, CourseCardProps } from '@/types/course.types';
import { stopAllStreams } from "@/lib/MediaRegistry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CourseCard } from "@/components/course/CourseCard";
import { BookOpen, TrendingUp } from "lucide-react";

export default function Page() {
  useEffect(() => {
    setTimeout(stopAllStreams, 1000);
  }, []);
  const { isAuthenticated, isAuthReady } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      console.log("User not authenticated, redirecting to auth page");
      navigate({ to: '/auth' });
    }
  }, [isAuthenticated, isAuthReady, navigate]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="px-4 sm:px-6 lg:px-8 w-full max-w-md">
          <EmptyState
            title="Loading..."
            description="Preparing your dashboard..."
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="px-4 sm:px-6 lg:px-8 w-full max-w-md">
          <EmptyState
            title="Authentication Required"
            description="Please log in to view your dashboard"
            actionText="Go to Login"
            onAction={() => navigate({ to: '/auth' })}
          />
        </div>
      </div>
    );
  }
  return <DashboardContent />;
}


function DashboardContent() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const studentName = user?.name || 'Student';

  // Greeting state & updater
  const [greeting, setGreeting] = useState(getGreeting());
  useEffect(() => {
    const intervalId = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);
  // Only fetch enrollments if user is authenticated (i.e., token is present)
  const { token } = useAuthStore();

  // Fetch more enrollments to properly populate tabs
  const {
    data: enrollmentsData,
    isLoading: enrollmentsLoading,
  } = useUserEnrollments(1, 100, !!token); // Fetching 100 to get a good list for client-side filtering safely for now

// console.log("--enrollments-in dashboard---", enrollmentsData);
  // Cast to CourseCardProps['enrollment'][] to satisfy type checker if needed, 
  // but simpler to let TS infer from usage if types match. 
  // Explicitly casting here to be safe given previous type errors.
  const enrollments = (enrollmentsData?.enrollments || []) as unknown as CourseCardProps['enrollment'][];
  const totalEnrollments = enrollmentsData?.totalDocuments || 0;

  const {
    data: publicCoursesData,
    isLoading: publicCoursesLoading
  } = usePublicCourses(1, 5, !!token);

  useWatchtimeTotal();



  // const filteredEnrollement = enrollments.filter(enrollment=>enrollment.role == "STUDENT");
  const [completion, setCompletion] = useState<CoursePctCompletion[]>([]);

  // Calculate distinct lists for tabs
  const activeEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => enrollment.percentCompleted !== 100);
  }, [enrollments]);

  const completedEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => enrollment.percentCompleted === 100);
  }, [enrollments]);

  const totalProgress = useMemo(() => {
    const completed = completion.reduce((a, c) => a + (c.completedItems || 0), 0);
    const total = completion.reduce((a, c) => a + (c.totalItems || 0), 0);
    return total ? Math.round((completed / total) * 100) : 0;
  }, [completion]);

  // Tab State
  const [activeTab, setActiveTab] = useState("available");
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false);

  // Set default tab based on enrollments once loaded
  useEffect(() => {
    if (!enrollmentsLoading && !hasSetInitialTab) {
      if (activeEnrollments.length > 0) {
        setActiveTab("enrolled");
      } else {
        setActiveTab("available");
      }
      setHasSetInitialTab(true);
    }
  }, [enrollmentsLoading, activeEnrollments.length, hasSetInitialTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <>
      {/* Greeting and Stat Cards in two separate flex boxes */}
      <div className="flex flex-col lg:flex-row justify-between items-start mb-8 px-0 sm:px-6 lg:px-8 xl:px-0 gap-6 transition-all duration-300">
        {/* Left: Greeting Box */}
        <div className="flex-1 bg-background rounded-lg lg:px-6 py-6 px-0">
          <h1 className="text-3xl font-bold mb-1">
            {greeting}, {studentName} 👋
          </h1>
          <p className="text-muted-foreground">
            Welcome to your learning dashboard, check your priority learning.
          </p>
        </div>
        {/* Right: Stat Cards */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch w-full sm:w-auto">
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            value={enrollmentsLoading ? "—" : `${totalEnrollments}`}
            label="Enrolled Courses"
          />
          <StatCard icon={<TrendingUp className="h-5 w-5 text-green-500" />}
            value={`${totalProgress}%`} label="Completion Percentage" />
        </div>
      </div>

      {/* Main content and sidebar */}
      <div className="mb-6 px-0 sm:px-6 lg:px-8 xl:px-0">


      </div>

      <div className="container mx-auto px-0 sm:px-6 lg:px-8 xl:px-0 py-6 flex flex-col lg:flex-row gap-6 transition-all duration-300">
        <main className="flex-1 w-full">

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 w-full">
            <TabsList className="w-full md:w-auto grid grid-cols-3 h-auto p-1 bg-muted/20 rounded-xl">
              <TabsTrigger
                value="available"
                className="py-3 px-6 text-lg font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 cursor-pointer"
              >
                Available {(publicCoursesData?.totalDocuments || 0) > 0 && <span className="ml-2 text-sm opacity-80 bg-primary-foreground/20 px-2 py-0.5 rounded-full">{publicCoursesData?.totalDocuments || 0}</span>}
              </TabsTrigger>
              <TabsTrigger
                value="enrolled"
                className="py-3 px-6 text-lg font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 cursor-pointer"
              >
                Enrolled {activeEnrollments.length > 0 && <span className="ml-2 text-sm opacity-80 bg-primary-foreground/20 px-2 py-0.5 rounded-full">{activeEnrollments.length}</span>}
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="py-3 px-6 text-lg font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 cursor-pointer"
              >
                Completed {completedEnrollments.length > 0 && <span className="ml-2 text-sm opacity-80 bg-primary-foreground/20 px-2 py-0.5 rounded-full">{completedEnrollments.length}</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="mt-6 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
              <CourseSection
                title="Recommended for you"
                enrollments={publicCoursesData?.courses?.map((course: any) => ({
                  courseId: course.courseId,
                  courseVersionId: course.courseVersionId,
                  course: {
                    name: course.courseName,
                    description: course.courseDescription,
                    instructors: course.instructors
                  }
                })) || []}
                isLoading={publicCoursesLoading}
                showViewAll
                onViewAll={() => navigate({ to: '/student/courses' })}
                variant="dashboard"
                cardVariant="available"
                emptyStateConfig={{
                  title: "Discover new courses",
                  description: "Explore our course catalog to find your next learning adventure",
                  actionText: "Browse All Courses",
                  onAction: () => navigate({ to: '/student/courses' })
                }}
              />
            </TabsContent>

            <TabsContent value="enrolled" className="mt-6 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Your Active Courses</h2>
                </div>

                {enrollmentsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-6">
                          <div className="h-6 w-1/3 bg-muted rounded animate-pulse mb-4" />
                          <div className="h-4 w-2/3 bg-muted/60 rounded animate-pulse mb-6" />
                          <div className="h-2 w-full bg-muted/40 rounded animate-pulse" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : activeEnrollments.length > 0 ? (
                  <div className="space-y-4">
                    {activeEnrollments.map((enrollment, index) => (
                      <CourseCard
                        key={enrollment._id || index}
                        enrollment={enrollment}
                        index={index}
                        isLoading={false}
                        variant="dashboard"
                        completion={completion}
                        setCompletion={setCompletion}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No active courses"
                    description="You don't have any active courses at the moment."
                    actionText="Browse Available Courses"
                    onAction={() => setActiveTab("available")}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-6 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Completed Courses</h2>
                </div>

                {enrollmentsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-6">
                          <div className="h-6 w-1/3 bg-muted rounded animate-pulse mb-4" />
                          <div className="h-4 w-2/3 bg-muted/60 rounded animate-pulse mb-6" />
                          <div className="h-2 w-full bg-muted/40 rounded animate-pulse" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : completedEnrollments.length > 0 ? (
                  <div className="space-y-4">
                    {completedEnrollments.map((enrollment, index) => (
                      <CourseCard
                        key={enrollment._id || index}
                        enrollment={enrollment}
                        index={index}
                        isLoading={false}
                        variant="dashboard"
                        completion={completion}
                        setCompletion={setCompletion}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No completed courses yet"
                    description="Finish a course to see it here and claim your certificate!"
                    actionText="Go to Enrolled Courses"
                    onAction={() => setActiveTab("enrolled")}
                  />
                )}
              </div>
            </TabsContent>
          </Tabs>

        </main>
        <aside className="w-full lg:w-80">
          <div className="sticky top-6">
            <DashboardSidebar enrollments={enrollments} />
          </div>
        </aside>
      </div>
    </>
  );
}
