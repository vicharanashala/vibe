import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUserEnrollments, useWatchtimeTotal, usePublicCourses, useUserEnrollmentStats } from "@/hooks/hooks";
import { useNavigate } from "@tanstack/react-router";

// Import components
import { StatCard } from "@/components/ui/StatCard";
import { CourseSection } from "@/components/course/CourseSection";
import { LearningInsights } from "@/components/dashboard/LearningInsights";
// import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"; // Hidden: Learning Checklist sidebar (commented out, not removed)
import { EmptyState } from "@/components/ui/EmptyState";
import { getGreeting } from "@/utils/helpers";
import type { CourseCardProps } from '@/types/course.types';
import { stopAllStreams } from "@/lib/MediaRegistry";
import { cn } from "@/utils/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseCard } from "@/components/course/CourseCard";
import { CourseListCard } from "@/components/course/CourseListCard";
import { FollowUpInvitesBanner } from "@/components/course/FollowUpInvitesBanner";
import { NewAnnouncementsPopup } from "@/components/announcements/NewAnnouncementsPopup";
import { BookOpen, Target, GraduationCap, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Cards / List view switcher. Extracted so the three course tabs share one
 * implementation. Behaviour (and the persisted `viewMode`) is unchanged — this
 * only renders the toggle and calls back into the parent's `setViewMode`.
 */
function ViewSwitcher({ viewMode, setViewMode }: { viewMode: 'grid' | 'list'; setViewMode: (mode: 'grid' | 'list') => void }) {
  const baseBtn = "h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-300";
  const active = "bg-white text-foreground shadow-sm dark:bg-white/10 dark:text-white";
  const inactive = "text-muted-foreground hover:text-foreground";

  return (
    <div className="flex items-center gap-1 rounded-xl border border-neutral-200/70 bg-neutral-100/80 p-1 dark:border-white/[0.07] dark:bg-white/[0.04]">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Card view"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={cn(baseBtn, viewMode === 'grid' ? active : inactive)}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Card view</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={cn(baseBtn, viewMode === 'list' ? active : inactive)}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>List view</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

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

  // Cast to CourseCardProps['enrollment'][] to satisfy type checker if needed,
  // but simpler to let TS infer from usage if types match.
  // Explicitly casting here to be safe given previous type errors.
  const enrollments = (enrollmentsData?.enrollments || []) as unknown as CourseCardProps['enrollment'][];
  const totalEnrollments = enrollmentsData?.totalDocuments || 0;

  const {
    data: publicCoursesData,
    isLoading: publicCoursesLoading
  } = usePublicCourses(1, 5, !!token);

  // Keep the watch-time query warm (preserves original prefetch behaviour); not displayed.
  useWatchtimeTotal();
  const { data: statsData, isLoading: statsLoading } = useUserEnrollmentStats(!!token);


   // Calculate distinct lists for tabs
  const activeEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => (enrollment.percentCompleted ?? 0) !== 100);
  }, [enrollments]);

  const completedEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => (enrollment.percentCompleted ?? 0) === 100);
  }, [enrollments]);

  const totalProgress = statsData?.overallProgress ?? 0;

  const enrolledCount = statsData?.totalCourses ?? totalEnrollments;
  const completedCount = statsData?.completedCourses ?? completedEnrollments.length;

  // Tab State
  const [activeTab, setActiveTab] = useState("available");
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false);

  // View Mode State (Persisted)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('student_dashboard_view_mode');
      return (saved === 'list' ? 'list' : 'grid') as 'grid' | 'list';
    }
    return 'grid';
  });

  useEffect(() => {
    localStorage.setItem('student_dashboard_view_mode', viewMode);
  }, [viewMode]);

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
      {/* Auto-popup any announcements the student hasn't seen yet */}
      <NewAnnouncementsPopup />
      <div className="container mx-auto px-0 sm:px-6 lg:px-8 xl:px-0 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <main className="w-full min-w-0 flex-1 space-y-6">
            {/* Hero + Stat Cards Section */}
            <section className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.06] dark:bg-white/[0.03] dark:ring-white/[0.04] sm:p-8">
              {/* Ambient gloss */}
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

              <div className="relative">
                <p className="mb-1 text-sm font-semibold tracking-wide text-primary">Your Learning Journey</p>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {greeting}, {studentName} 👋
                </h1>
                <p className="mt-2 text-base text-muted-foreground sm:text-lg">
                  Welcome back — here's your progress at a glance.
                </p>
              </div>

              <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  tone="amber"
                  icon={<BookOpen className="h-5 w-5" />}
                  value={statsLoading ? "—" : `${enrolledCount}`}
                  label="Enrolled Courses"
                  sublabel="In your catalog"
                />
                <StatCard
                  tone="emerald"
                  icon={<Target className="h-5 w-5" />}
                  value={statsLoading ? "—" : `${totalProgress}%`}
                  label="Overall Progress"
                  sublabel="Across all courses"
                />
                <StatCard
                  tone="violet"
                  icon={<GraduationCap className="h-5 w-5" />}
                  value={statsLoading ? "—" : `${completedCount}`}
                  label="Courses Completed"
                  sublabel="Successfully finished"
                />
              </div>
            </section>

            {/* Exclusive follow-up course invites unlocked by completing a course */}
            <FollowUpInvitesBanner />

            {/* Personalized "next best action" + at-a-glance insights, derived
                from data already fetched above (read-only). */}
            <LearningInsights
              stats={statsData}
              activeEnrollments={activeEnrollments}
              isLoading={statsLoading || enrollmentsLoading}
              onBrowse={() => navigate({ to: '/student/courses' })}
              onGoToEnrolled={() => setActiveTab('enrolled')}
            />

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
              <TabsList className="w-full md:w-fit flex h-auto p-1 bg-slate-100/80 dark:bg-white/[0.04] rounded-full border border-slate-200/50 dark:border-white/[0.07] overflow-x-auto scrollbar-hide">
                <TabsTrigger
                  value="available"
                  className="rounded-full py-2 px-3 md:py-2.5 md:px-6 text-xs md:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-primary data-[state=active]:shadow-sm whitespace-nowrap"
                >
                  Available
                  {(publicCoursesData?.totalDocuments || 0) > 0 && (
                    <span className="ml-1.5 md:ml-2 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                      {publicCoursesData?.totalDocuments}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="enrolled"
                  className="rounded-full py-2 px-3 md:py-2.5 md:px-6 text-xs md:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-primary data-[state=active]:shadow-sm whitespace-nowrap"
                >
                  Enrolled
                  {activeEnrollments.length > 0 && (
                    <span className="ml-1.5 md:ml-2 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold rounded-full bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20">
                      {activeEnrollments.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="rounded-full py-2 px-3 md:py-2.5 md:px-6 text-xs md:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-primary data-[state=active]:shadow-sm whitespace-nowrap"
                >
                  Completed
                  {completedEnrollments.length > 0 && (
                    <span className="ml-1.5 md:ml-2 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold rounded-full bg-green-100 text-green-600 border border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20">
                      {completedEnrollments.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="available" className="mt-6 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight">Recommended for you</h2>
                    <p className="text-sm text-muted-foreground">Hand-picked courses to start next</p>
                  </div>
                  <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <CourseSection
                  title=""
                  viewMode={viewMode}
                  enrollments={publicCoursesData?.courses?.map((course: any) => ({
                    courseId: course.courseId,
                    courseVersionId: course.courseVersionId,
                    course: {
                      name: course.courseName,
                      description: course.courseDescription,
                      instructors: course.instructors
                    },
                    cohortId: course.cohortId,
                    cohortName: course.cohortName,
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-bold tracking-tight">Active Courses</h2>
                      <p className="text-sm text-muted-foreground">
                        {activeEnrollments.length} in progress &bull; {completedEnrollments.length} completed
                      </p>
                    </div>
                    <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                  </div>

                  {enrollmentsLoading ? (
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                    )}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={cn(
                          "w-full bg-muted animate-pulse",
                          viewMode === 'grid' ? "h-[400px] rounded-[24px]" : "h-32 rounded-2xl"
                        )} />
                      ))}
                    </div>
                  ) : activeEnrollments.length > 0 ? (
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                    )}>
                      {activeEnrollments.map((enrollment, index) => (
                        viewMode === 'grid' ? (
                          <CourseCard
                            key={enrollment._id || index}
                            enrollment={enrollment}
                            index={index}
                            isLoading={false}
                            variant="dashboard"
                          />
                        ) : (
                          <CourseListCard
                            key={enrollment._id || index}
                            enrollment={enrollment}
                            index={index}
                            isLoading={false}
                            variant="dashboard"
                          />
                        )
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-bold tracking-tight">Completed Courses</h2>
                      <p className="text-sm text-muted-foreground">Your finished learning &amp; certificates</p>
                    </div>
                    <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                  </div>

                  {enrollmentsLoading ? (
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                    )}>
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className={cn(
                          "w-full bg-muted animate-pulse",
                          viewMode === 'grid' ? "h-[400px] rounded-[24px]" : "h-32 rounded-2xl"
                        )} />
                      ))}
                    </div>
                  ) : completedEnrollments.length > 0 ? (
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                    )}>
                      {completedEnrollments.map((enrollment, index) => (
                        viewMode === 'grid' ? (
                          <CourseCard
                            key={enrollment._id || index}
                            enrollment={enrollment}
                            index={index}
                            isLoading={false}
                            variant="dashboard"
                          />
                        ) : (
                          <CourseListCard
                            key={enrollment._id || index}
                            enrollment={enrollment}
                            index={index}
                            isLoading={false}
                            variant="dashboard"
                          />
                        )
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
          {/* Hidden: Learning Checklist sidebar (commented out, not removed) */}
          {/* <aside className="w-full lg:w-80">
            <div className="sticky top-6">
              <DashboardSidebar enrollments={enrollments} />
            </div>
          </aside> */}
        </div>
      </div>
    </>
  );
}
